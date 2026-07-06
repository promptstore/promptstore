import { Span, SpanStatus } from '../../core/telemetry/canonical';
import { SpanStore, TraceSummary, ListTracesParams, CostRollupRow, CostKpis, CostTotals, CostDistributionRow } from './SpanStore';

// Postgres-backed span store. Spans live in the flat `spans` table; the trace
// tree is reconstructed on read from parent_span_id. Upserts on
// (trace_id, span_id) so a span's start and end patch the same row.

const COLUMNS = [
  'trace_id', 'span_id', 'parent_span_id', 'workspace_id', 'span_kind', 'name',
  'start_time', 'end_time', 'status', 'status_message', 'provider',
  'request_model', 'response_model', 'prompt_tokens', 'completion_tokens',
  'total_tokens', 'cached_tokens', 'reasoning_tokens', 'cost_input',
  'cost_output', 'cost_total', 'currency', 'attributes', 'events', 'links',
  'payload_ref', 'session_id', 'user_id', 'sdk_version', 'seq',
];

export function PostgresSpanStore({ pg, logger }: { pg: any; logger: any }): SpanStore {

  function toRowValues(span: Span): any[] {
    const usage = span.usage || {};
    return [
      span.trace_id,
      span.span_id,
      span.parent_span_id || null,
      span.workspace_id,
      span.span_kind,
      span.name || null,
      span.start_time,
      span.end_time || null,
      span.status || SpanStatus.Unset,
      span.status_message || null,
      span.provider || null,
      span.request_model || null,
      span.response_model || null,
      usage.prompt_tokens ?? null,
      usage.completion_tokens ?? null,
      usage.total_tokens ?? null,
      usage.cached_tokens ?? null,
      usage.reasoning_tokens ?? null,
      span.cost_input ?? null,
      span.cost_output ?? null,
      span.cost_total ?? null,
      span.currency || 'USD',
      // empty objects/arrays are written as NULL so a late-arriving start
      // payload (events: []) can never clobber real events via COALESCE
      span.attributes && Object.keys(span.attributes).length ? JSON.stringify(span.attributes) : null,
      span.events && span.events.length ? JSON.stringify(span.events) : null,
      span.links && span.links.length ? JSON.stringify(span.links) : null,
      span.payload_ref || null,
      span.session_id || null,
      span.user_id || null,
      span.sdk_version || null,
      span.seq ?? null,
    ];
  }

  function mapRow(row: any): Span {
    return {
      trace_id: row.trace_id,
      span_id: row.span_id,
      parent_span_id: row.parent_span_id,
      workspace_id: row.workspace_id,
      span_kind: row.span_kind,
      name: row.name,
      start_time: row.start_time instanceof Date ? row.start_time.toISOString() : row.start_time,
      end_time: row.end_time instanceof Date ? row.end_time.toISOString() : row.end_time,
      status: row.status,
      status_message: row.status_message,
      provider: row.provider,
      request_model: row.request_model,
      response_model: row.response_model,
      usage: {
        prompt_tokens: row.prompt_tokens,
        completion_tokens: row.completion_tokens,
        total_tokens: row.total_tokens,
        cached_tokens: row.cached_tokens,
        reasoning_tokens: row.reasoning_tokens,
      },
      cost_input: row.cost_input != null ? Number(row.cost_input) : null,
      cost_output: row.cost_output != null ? Number(row.cost_output) : null,
      cost_total: row.cost_total != null ? Number(row.cost_total) : null,
      currency: row.currency,
      attributes: row.attributes || undefined,
      events: row.events || undefined,
      links: row.links || undefined,
      payload_ref: row.payload_ref,
      session_id: row.session_id,
      user_id: row.user_id,
      sdk_version: row.sdk_version,
      seq: row.seq != null ? Number(row.seq) : null,
    };
  }

  // Merge two payloads for the same span within one batch, mirroring the SQL
  // ON CONFLICT merge: later non-null wins, earliest start, end/status stick,
  // highest seq. Required because a single multi-row INSERT ... ON CONFLICT
  // cannot touch the same (trace_id, span_id) twice ("cannot affect row a
  // second time") — and a start + end of the same span routinely share a batch.
  function mergeSpan(a: Span, b: Span): Span {
    return {
      ...a,
      ...Object.fromEntries(Object.entries(b).filter(([, v]) => v != null)),
      start_time: a.start_time < b.start_time ? a.start_time : b.start_time,
      end_time: b.end_time || a.end_time,
      status: b.status && b.status !== 'unset' ? b.status : a.status,
      usage: { ...(a.usage || {}), ...Object.fromEntries(Object.entries(b.usage || {}).filter(([, v]) => v != null)) },
      events: (b.events && b.events.length ? b.events : a.events),
      links: (b.links && b.links.length ? b.links : a.links),
      attributes: (b.attributes && Object.keys(b.attributes).length ? b.attributes : a.attributes),
      seq: Math.max(a.seq ?? 0, b.seq ?? 0),
    };
  }

  async function writeSpans(spans: Span[]): Promise<void> {
    if (!spans || spans.length === 0) return;
    // coalesce duplicates within the batch (see mergeSpan)
    const byKey = new Map<string, Span>();
    for (const span of spans) {
      const key = `${span.trace_id}:${span.span_id}`;
      const existing = byKey.get(key);
      byKey.set(key, existing ? mergeSpan(existing, span) : span);
    }
    const deduped = Array.from(byKey.values());
    const ncols = COLUMNS.length;
    const values: any[] = [];
    const tuples: string[] = [];
    deduped.forEach((span, i) => {
      const placeholders = COLUMNS.map((_, j) => `$${i * ncols + j + 1}`);
      tuples.push(`(${placeholders.join(', ')})`);
      values.push(...toRowValues(span));
    });
    // On conflict, merge: keep earliest start, let a provided end/status/usage
    // win, but never overwrite an existing value with null (out-of-order patches).
    const q = `
      INSERT INTO spans (${COLUMNS.join(', ')})
      VALUES ${tuples.join(', ')}
      ON CONFLICT (trace_id, span_id) DO UPDATE SET
        parent_span_id   = COALESCE(EXCLUDED.parent_span_id, spans.parent_span_id),
        name             = COALESCE(EXCLUDED.name, spans.name),
        start_time       = LEAST(EXCLUDED.start_time, spans.start_time),
        end_time         = COALESCE(EXCLUDED.end_time, spans.end_time),
        status           = CASE WHEN EXCLUDED.status = 'unset' THEN spans.status ELSE EXCLUDED.status END,
        status_message   = COALESCE(EXCLUDED.status_message, spans.status_message),
        provider         = COALESCE(EXCLUDED.provider, spans.provider),
        request_model    = COALESCE(EXCLUDED.request_model, spans.request_model),
        response_model   = COALESCE(EXCLUDED.response_model, spans.response_model),
        prompt_tokens    = COALESCE(EXCLUDED.prompt_tokens, spans.prompt_tokens),
        completion_tokens= COALESCE(EXCLUDED.completion_tokens, spans.completion_tokens),
        total_tokens     = COALESCE(EXCLUDED.total_tokens, spans.total_tokens),
        cached_tokens    = COALESCE(EXCLUDED.cached_tokens, spans.cached_tokens),
        reasoning_tokens = COALESCE(EXCLUDED.reasoning_tokens, spans.reasoning_tokens),
        cost_input       = COALESCE(EXCLUDED.cost_input, spans.cost_input),
        cost_output      = COALESCE(EXCLUDED.cost_output, spans.cost_output),
        cost_total       = COALESCE(EXCLUDED.cost_total, spans.cost_total),
        attributes       = COALESCE(EXCLUDED.attributes, spans.attributes),
        events           = COALESCE(EXCLUDED.events, spans.events),
        links            = COALESCE(EXCLUDED.links, spans.links),
        payload_ref      = COALESCE(EXCLUDED.payload_ref, spans.payload_ref),
        seq              = GREATEST(COALESCE(EXCLUDED.seq, 0), COALESCE(spans.seq, 0))
    `;
    await pg.query(q, values);
  }

  async function getSpans(workspaceId: number, traceId: string, opts: { sinceSeq?: number } = {}): Promise<Span[]> {
    const params: any[] = [workspaceId, traceId];
    let where = 'workspace_id = $1 AND trace_id = $2';
    if (opts.sinceSeq != null) {
      params.push(opts.sinceSeq);
      where += ` AND seq > $${params.length}`;
    }
    const { rows } = await pg.query(`
      SELECT ${COLUMNS.join(', ')}
      FROM spans
      WHERE ${where}
      ORDER BY COALESCE(seq, 0), start_time
      `, params);
    return rows.map(mapRow);
  }

  async function listTraces(workspaceId: number, params: ListTracesParams = {}): Promise<{ count: number; data: TraceSummary[] }> {
    const { limit = 50, offset = 0, name, from, to, status } = params;
    const args: any[] = [workspaceId];
    const conds: string[] = ['workspace_id = $1'];
    if (from) { args.push(from); conds.push(`start_time >= $${args.length}`); }
    if (to) { args.push(to); conds.push(`start_time <= $${args.length}`); }
    const where = conds.join(' AND ');

    // Aggregate spans into per-trace summaries. The root span (parent_span_id
    // IS NULL) supplies name/status/user for the trace.
    const base = `
      FROM (
        SELECT
          trace_id,
          MIN(start_time) AS start_time,
          CASE WHEN bool_or(end_time IS NULL) THEN NULL ELSE MAX(end_time) END AS end_time,
          bool_or(end_time IS NULL) AS running,
          COUNT(*) AS span_count,
          COUNT(*) FILTER (WHERE span_kind = 'loop.iteration') AS turns,
          COUNT(*) FILTER (WHERE span_kind = 'tool.call') AS tool_calls,
          COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
          COALESCE(SUM(completion_tokens), 0) AS completion_tokens,
          COALESCE(SUM(cached_tokens), 0) AS cached_tokens,
          COALESCE(SUM(total_tokens), 0) AS total_tokens,
          COALESCE(SUM(cost_total), 0) AS cost_total,
          MAX(name) FILTER (WHERE parent_span_id IS NULL) AS name,
          MAX(status) FILTER (WHERE parent_span_id IS NULL) AS status,
          MAX(user_id) FILTER (WHERE parent_span_id IS NULL) AS user_id
        FROM spans
        WHERE ${where}
        GROUP BY trace_id
      ) t
    `;

    const havingConds: string[] = [];
    if (name) { args.push(`%${name}%`); havingConds.push(`t.name ILIKE $${args.length}`); }
    if (status) { args.push(status); havingConds.push(`t.status = $${args.length}`); }
    const having = havingConds.length ? `WHERE ${havingConds.join(' AND ')}` : '';

    const countRes = await pg.query(`SELECT COUNT(*)::int AS count FROM (SELECT trace_id ${base} ${having}) c`, args);
    const count = countRes.rows[0]?.count || 0;

    args.push(limit);
    const limitIdx = args.length;
    args.push(offset);
    const offsetIdx = args.length;
    const { rows } = await pg.query(`
      SELECT t.* ${base} ${having}
      ORDER BY t.start_time DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
      `, args);

    const data: TraceSummary[] = rows.map((r: any) => {
      const start = r.start_time instanceof Date ? r.start_time : new Date(r.start_time);
      const end = r.end_time ? (r.end_time instanceof Date ? r.end_time : new Date(r.end_time)) : null;
      return {
        trace_id: r.trace_id,
        workspace_id: workspaceId,
        name: r.name,
        status: r.status || 'unset',
        start_time: start.toISOString(),
        end_time: end ? end.toISOString() : null,
        duration_ms: end ? end.getTime() - start.getTime() : null,
        span_count: Number(r.span_count),
        turns: Number(r.turns),
        tool_calls: Number(r.tool_calls),
        prompt_tokens: Number(r.prompt_tokens),
        completion_tokens: Number(r.completion_tokens),
        cached_tokens: Number(r.cached_tokens),
        total_tokens: Number(r.total_tokens),
        cost_total: Number(r.cost_total),
        user_id: r.user_id,
        running: !!r.running,
      };
    });
    return { count, data };
  }

  async function deleteTraces(workspaceId: number, traceIds: string[]): Promise<{ spans: number; traces: number }> {
    if (!traceIds || traceIds.length === 0) return { spans: 0, traces: 0 };
    // Workspace-scoped so a caller can only ever delete its own traces.
    const { rows, rowCount } = await pg.query(`
      DELETE FROM spans
      WHERE workspace_id = $1 AND trace_id = ANY($2::text[])
      RETURNING trace_id
      `, [workspaceId, traceIds]);
    const traces = new Set(rows.map((r: any) => r.trace_id)).size;
    return { spans: rowCount || 0, traces };
  }

  async function costRollup(workspaceId: number, opts: { from: string; to: string; bucket?: 'day' | 'hour'; groupBy?: string }): Promise<CostRollupRow[]> {
    const bucket = opts.bucket === 'hour' ? 'hour' : 'day';
    const groupCol = ({
      model: 'response_model',
      provider: 'provider',
      user: 'user_id',
    } as Record<string, string>)[opts.groupBy || 'model'] || 'response_model';
    const { rows } = await pg.query(`
      SELECT
        to_char(date_trunc('${bucket}', start_time), 'YYYY-MM-DD"T"HH24:00') AS bucket,
        COALESCE(${groupCol}, 'unknown') AS grp,
        COALESCE(SUM(cost_total), 0) AS cost,
        COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
        COALESCE(SUM(completion_tokens), 0) AS completion_tokens,
        COALESCE(SUM(cached_tokens), 0) AS cached_tokens,
        COALESCE(SUM(reasoning_tokens), 0) AS reasoning_tokens,
        COUNT(DISTINCT trace_id) AS runs
      FROM spans
      WHERE workspace_id = $1 AND start_time >= $2 AND start_time <= $3 AND span_kind = 'model.call'
      GROUP BY 1, 2
      ORDER BY 1
      `, [workspaceId, opts.from, opts.to]);
    return rows.map((r: any) => ({
      bucket: r.bucket,
      group: r.grp,
      cost: Number(r.cost),
      prompt_tokens: Number(r.prompt_tokens),
      completion_tokens: Number(r.completion_tokens),
      cached_tokens: Number(r.cached_tokens),
      reasoning_tokens: Number(r.reasoning_tokens),
      runs: Number(r.runs),
    }));
  }

  // model-call totals over a window (cost/tokens) + run count over all spans
  async function totalsInWindow(workspaceId: number, from: string, to: string): Promise<CostTotals> {
    const { rows } = await pg.query(`
      SELECT
        COALESCE(SUM(cost_total), 0) AS cost,
        COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
        COALESCE(SUM(completion_tokens), 0) AS completion_tokens,
        COALESCE(SUM(cached_tokens), 0) AS cached_tokens,
        COALESCE(SUM(reasoning_tokens), 0) AS reasoning_tokens,
        COALESCE(SUM(total_tokens), 0) AS total_tokens
      FROM spans
      WHERE workspace_id = $1 AND start_time >= $2 AND start_time <= $3 AND span_kind = 'model.call'
      `, [workspaceId, from, to]);
    const runsRes = await pg.query(`
      SELECT COUNT(DISTINCT trace_id)::int AS runs
      FROM spans WHERE workspace_id = $1 AND start_time >= $2 AND start_time <= $3
      `, [workspaceId, from, to]);
    const r = rows[0];
    return {
      cost: Number(r.cost),
      prompt_tokens: Number(r.prompt_tokens),
      completion_tokens: Number(r.completion_tokens),
      cached_tokens: Number(r.cached_tokens),
      reasoning_tokens: Number(r.reasoning_tokens),
      total_tokens: Number(r.total_tokens),
      runs: Number(runsRes.rows[0].runs),
    };
  }

  async function costKpis(workspaceId: number, opts: { from: string; to: string }): Promise<CostKpis> {
    const fromMs = new Date(opts.from).getTime();
    const toMs = new Date(opts.to).getTime();
    const span = Math.max(toMs - fromMs, 1);
    const prevFrom = new Date(fromMs - span).toISOString();
    const prevTo = opts.from;
    const [current, previous] = await Promise.all([
      totalsInWindow(workspaceId, opts.from, opts.to),
      totalsInWindow(workspaceId, prevFrom, prevTo),
    ]);
    return { current, previous, from: opts.from, to: opts.to };
  }

  async function costDistribution(workspaceId: number, opts: { from: string; to: string }): Promise<CostDistributionRow[]> {
    const { rows } = await pg.query(`
      SELECT COALESCE(provider, 'unknown') AS provider,
             COALESCE(response_model, request_model, 'unknown') AS model,
             COALESCE(SUM(cost_total), 0) AS cost,
             COALESCE(SUM(total_tokens), 0) AS total_tokens
      FROM spans
      WHERE workspace_id = $1 AND start_time >= $2 AND start_time <= $3 AND span_kind = 'model.call'
      GROUP BY 1, 2
      HAVING COALESCE(SUM(cost_total), 0) > 0
      ORDER BY cost DESC
      `, [workspaceId, opts.from, opts.to]);
    return rows.map((r: any) => ({ provider: r.provider, model: r.model, cost: Number(r.cost), total_tokens: Number(r.total_tokens) }));
  }

  async function costInWindow(workspaceId: number, opts: { from: string; to: string }): Promise<number> {
    const { rows } = await pg.query(`
      SELECT COALESCE(SUM(cost_total), 0) AS cost
      FROM spans WHERE workspace_id = $1 AND start_time >= $2 AND start_time <= $3 AND span_kind = 'model.call'
      `, [workspaceId, opts.from, opts.to]);
    return Number(rows[0].cost);
  }

  async function reapStaleSpans(olderThanMs: number): Promise<{ spans: number; traces: number }> {
    // A trace is stale when it still has an open span but nothing has been
    // ingested for it in `olderThanMs` (using received_at, the server-side
    // ingest time, so a slow/long but still-live run keeps itself fresh and is
    // not reaped). Close each open span in a stale trace at the trace's last
    // known activity (never before the span's own start), marking it errored.
    const q = `
      WITH stale AS (
        SELECT trace_id, MAX(received_at) AS last_activity
        FROM spans
        GROUP BY trace_id
        HAVING bool_or(end_time IS NULL)
           AND MAX(received_at) < NOW() - ($1::double precision * INTERVAL '1 millisecond')
      )
      UPDATE spans s
      SET end_time       = GREATEST(st.last_activity, s.start_time),
          status         = CASE WHEN s.status = 'unset' THEN 'error' ELSE s.status END,
          status_message = COALESCE(s.status_message, 'reaped: no end received within TTL (abandoned run)')
      FROM stale st
      WHERE s.trace_id = st.trace_id
        AND s.end_time IS NULL
      RETURNING s.trace_id
    `;
    const { rows, rowCount } = await pg.query(q, [olderThanMs]);
    const traces = new Set(rows.map((r: any) => r.trace_id)).size;
    return { spans: rowCount || 0, traces };
  }

  return { writeSpans, getSpans, listTraces, deleteTraces, costRollup, costKpis, costDistribution, costInWindow, reapStaleSpans };
}
