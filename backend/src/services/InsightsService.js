// Harness tuning insights (Phase 5). Runs a set of analytical queries over the
// spans in a window and turns them into ranked, deep-linkable insight cards plus
// diagnostic chart data. Rule-based and deterministic — cheap and trustworthy.
//
// NOTE: the SQL here is Postgres-specific analytics (percentiles, json event
// unnest). When the ClickHouse SpanStore lands (Phase 6) these queries get a
// ClickHouse port; cache-hit trend already routes through spanStore.costRollup.

const SEVERITY_RANK = { critical: 0, serious: 1, warning: 2, info: 3, good: 4 };

export function InsightsService({ pg, logger, spanStore }) {

  const num = (v) => (v == null ? 0 : Number(v));
  const pct = (r) => `${Math.round(r * 100)}%`;
  const money = (n) => `$${Number(n || 0).toFixed(4)}`;

  // ---- primitive queries --------------------------------------------------
  async function loopLength(workspaceId, from, to) {
    const { rows } = await pg.query(`
      WITH per_trace AS (
        SELECT trace_id,
               COUNT(*) FILTER (WHERE span_kind = 'loop.iteration') AS turns,
               MAX(name) FILTER (WHERE parent_span_id IS NULL) AS name
        FROM spans WHERE workspace_id = $1 AND start_time >= $2 AND start_time <= $3
        GROUP BY trace_id
      )
      SELECT turns, COUNT(*)::int AS count,
             (array_agg(trace_id ORDER BY turns DESC))[1] AS sample_trace,
             (array_agg(name ORDER BY turns DESC))[1] AS sample_name
      FROM per_trace GROUP BY turns ORDER BY turns
    `, [workspaceId, from, to]);
    const histogram = rows.map(r => ({ turns: num(r.turns), count: num(r.count) }));
    const runs = histogram.reduce((a, h) => a + h.count, 0);
    // median/p95 over the expanded distribution
    const expanded = [];
    histogram.forEach(h => { for (let i = 0; i < h.count; i++) expanded.push(h.turns); });
    const q = (p) => expanded.length ? expanded[Math.min(expanded.length - 1, Math.floor(p * expanded.length))] : 0;
    const top = rows[rows.length - 1] || {};
    return {
      histogram, runs,
      median: q(0.5), p95: q(0.95),
      maxTurns: num(top.turns), maxTurnsTraceId: top.sample_trace, maxTurnsName: top.sample_name,
    };
  }

  async function toolStats(workspaceId, from, to) {
    const { rows } = await pg.query(`
      WITH t AS (
        SELECT name, status, trace_id,
               CASE WHEN end_time IS NOT NULL THEN EXTRACT(EPOCH FROM (end_time - start_time)) * 1000 END AS dur
        FROM spans WHERE workspace_id = $1 AND start_time >= $2 AND start_time <= $3 AND span_kind = 'tool.call'
      )
      SELECT name,
             COUNT(*)::int AS calls,
             COUNT(*) FILTER (WHERE status = 'error')::int AS errors,
             percentile_cont(0.5) WITHIN GROUP (ORDER BY dur) AS p50,
             percentile_cont(0.95) WITHIN GROUP (ORDER BY dur) AS p95,
             (array_agg(trace_id) FILTER (WHERE status = 'error'))[1] AS sample_error_trace,
             (array_agg(trace_id ORDER BY dur DESC NULLS LAST))[1] AS sample_slow_trace
      FROM t GROUP BY name ORDER BY calls DESC
    `, [workspaceId, from, to]);
    return rows.map(r => ({
      name: r.name || '(unnamed)', calls: num(r.calls), errors: num(r.errors),
      errorRate: num(r.calls) ? num(r.errors) / num(r.calls) : 0,
      p50Ms: Math.round(num(r.p50)), p95Ms: Math.round(num(r.p95)),
      sampleErrorTraceId: r.sample_error_trace, sampleSlowTraceId: r.sample_slow_trace,
    }));
  }

  async function failureStats(workspaceId, from, to) {
    const { rows } = await pg.query(`
      SELECT
        COUNT(*) FILTER (WHERE parent_span_id IS NULL)::int AS runs,
        COUNT(*) FILTER (WHERE parent_span_id IS NULL AND status = 'error')::int AS failed_runs,
        (array_agg(trace_id) FILTER (WHERE parent_span_id IS NULL AND status = 'error'))[1] AS sample_fail_trace
      FROM spans WHERE workspace_id = $1 AND start_time >= $2 AND start_time <= $3
    `, [workspaceId, from, to]);
    const r = rows[0] || {};
    return { runs: num(r.runs), failedRuns: num(r.failed_runs), sampleFailTraceId: r.sample_fail_trace };
  }

  async function costPerTrace(workspaceId, from, to) {
    const { rows } = await pg.query(`
      SELECT trace_id,
             MAX(name) FILTER (WHERE parent_span_id IS NULL) AS name,
             COALESCE(SUM(cost_total), 0) AS cost
      FROM spans WHERE workspace_id = $1 AND start_time >= $2 AND start_time <= $3
      GROUP BY trace_id HAVING COALESCE(SUM(cost_total), 0) > 0
      ORDER BY cost DESC
    `, [workspaceId, from, to]);
    return rows.map(r => ({ trace_id: r.trace_id, name: r.name, cost: num(r.cost) }));
  }

  // Unnest span events matching a name prefix (context ops, retries).
  async function eventScan(workspaceId, from, to, namePrefix) {
    const { rows } = await pg.query(`
      SELECT s.trace_id, s.span_id, e->>'name' AS name, e->'attributes' AS attributes
      FROM spans s, json_array_elements(s.events) e
      WHERE s.workspace_id = $1 AND s.start_time >= $2 AND s.start_time <= $3
        AND s.events IS NOT NULL AND e->>'name' LIKE $4
    `, [workspaceId, from, to, namePrefix]);
    return rows.map(r => ({ trace_id: r.trace_id, span_id: r.span_id, name: r.name, attributes: r.attributes || {} }));
  }

  // ---- rules → cards ------------------------------------------------------
  async function getInsights(workspaceId, { from, to }) {
    const [loops, tools, failures, costs, ctxEvents, retryEvents, cacheRollup] = await Promise.all([
      loopLength(workspaceId, from, to),
      toolStats(workspaceId, from, to),
      failureStats(workspaceId, from, to),
      costPerTrace(workspaceId, from, to),
      eventScan(workspaceId, from, to, 'ps.context.%'),
      eventScan(workspaceId, from, to, 'ps.retry%'),
      spanStore.costRollup(workspaceId, { from, to, bucket: 'day', groupBy: 'model' }),
    ]);

    const cards = [];
    const add = (c) => cards.push(c);

    // 1. runaway loops
    const loopThreshold = Math.max(15, loops.median * 3);
    if (loops.maxTurns >= loopThreshold && loops.maxTurns > 0) {
      add({
        id: 'runaway-loop', category: 'loop-length',
        severity: loops.maxTurns >= 30 ? 'critical' : 'warning',
        title: 'Runaway loop', metric: `${loops.maxTurns} turns (median ${loops.median})`,
        finding: `Run "${loops.maxTurnsName || loops.maxTurnsTraceId?.slice(0, 8)}" used ${loops.maxTurns} loop turns — well above the median of ${loops.median}.`,
        traceId: loops.maxTurnsTraceId,
      });
    }

    // 2. flaky tools / 3. slow tools
    for (const t of tools) {
      if (t.calls >= 3 && t.errorRate >= 0.1) {
        add({
          id: `tool-errors:${t.name}`, category: 'tool-errors',
          severity: t.errorRate >= 0.3 ? 'critical' : 'serious',
          title: `Flaky tool: ${t.name}`, metric: `${t.errors}/${t.calls} failed (${pct(t.errorRate)})`,
          finding: `Tool "${t.name}" failed ${t.errors} of ${t.calls} calls (${pct(t.errorRate)}).`,
          traceId: t.sampleErrorTraceId,
        });
      }
      if (t.calls >= 3 && t.p95Ms > 5000) {
        add({
          id: `tool-slow:${t.name}`, category: 'latency', severity: 'warning',
          title: `Slow tool: ${t.name}`, metric: `p95 ${t.p95Ms} ms`,
          finding: `Tool "${t.name}" is slow — p95 latency ${t.p95Ms} ms across ${t.calls} calls.`,
          traceId: t.sampleSlowTraceId,
        });
      }
    }

    // 4. context-window pressure (max utilization per trace from context events)
    const utilByTrace = {};
    for (const ev of ctxEvents) {
      const a = ev.attributes || {};
      if (a.window_tokens_after != null && a.window_limit) {
        const u = a.window_tokens_after / a.window_limit;
        if (!utilByTrace[ev.trace_id] || u > utilByTrace[ev.trace_id]) utilByTrace[ev.trace_id] = u;
      }
    }
    const pressured = Object.entries(utilByTrace).filter(([, u]) => u >= 0.9).sort((x, y) => y[1] - x[1]);
    if (pressured.length) {
      const [worstTrace, worstU] = pressured[0];
      add({
        id: 'context-pressure', category: 'context-pressure',
        severity: worstU >= 1.0 ? 'critical' : 'warning',
        title: 'Context-window pressure', metric: `${pressured.length} run(s) ≥ 90%; worst ${pct(worstU)}`,
        finding: `${pressured.length} run(s) exceeded 90% of the context window — the worst hit ${pct(worstU)}. Consider earlier compaction.`,
        traceId: worstTrace,
      });
    }

    // 5. low cache-hit
    const promptTot = cacheRollup.reduce((a, r) => a + r.prompt_tokens, 0);
    const cachedTot = cacheRollup.reduce((a, r) => a + r.cached_tokens, 0);
    const cacheRate = promptTot ? cachedTot / promptTot : 0;
    if (promptTot >= 50000 && cacheRate < 0.2) {
      add({
        id: 'low-cache-hit', category: 'cache', severity: 'info',
        title: 'Low prompt-cache hit rate', metric: pct(cacheRate),
        finding: `Only ${pct(cacheRate)} of prompt tokens were cache reads. Reusing a stable prompt prefix could cut cost materially.`,
      });
    }

    // 6. cost outliers (> median + 3σ and > 2× median)
    if (costs.length >= 4) {
      const vals = costs.map(c => c.cost).sort((a, b) => a - b);
      const median = vals[Math.floor(vals.length / 2)];
      const mean = vals.reduce((a, v) => a + v, 0) / vals.length;
      const sd = Math.sqrt(vals.reduce((a, v) => a + (v - mean) ** 2, 0) / vals.length);
      const threshold = Math.max(median + 3 * sd, 2 * median);
      const outlier = costs[0];   // most expensive (already ordered desc)
      if (outlier && outlier.cost > threshold && median > 0) {
        add({
          id: 'cost-outlier', category: 'cost', severity: 'warning',
          title: 'Cost outlier', metric: `${money(outlier.cost)} (${(outlier.cost / median).toFixed(1)}× median)`,
          finding: `Run "${outlier.name || outlier.trace_id.slice(0, 8)}" cost ${money(outlier.cost)} — ${(outlier.cost / median).toFixed(1)}× the median run (${money(median)}).`,
          traceId: outlier.trace_id,
        });
      }
    }

    // 7. failure hotspot
    if (failures.runs >= 3) {
      const rate = failures.failedRuns / failures.runs;
      if (rate >= 0.1) {
        add({
          id: 'failure-hotspot', category: 'failures',
          severity: rate >= 0.3 ? 'critical' : 'serious',
          title: 'Elevated failure rate', metric: `${failures.failedRuns}/${failures.runs} runs (${pct(rate)})`,
          finding: `${failures.failedRuns} of ${failures.runs} runs ended in error (${pct(rate)}).`,
          traceId: failures.sampleFailTraceId,
        });
      }
    }

    // 8. retry hotspot
    if (retryEvents.length) {
      const byTrace = {};
      retryEvents.forEach(e => { byTrace[e.trace_id] = (byTrace[e.trace_id] || 0) + 1; });
      const total = retryEvents.length;
      const [worstTrace, worstN] = Object.entries(byTrace).sort((a, b) => b[1] - a[1])[0];
      if (total >= 5) {
        add({
          id: 'retry-hotspot', category: 'retries', severity: 'info',
          title: 'Frequent retries', metric: `${total} retries; worst run ${worstN}`,
          finding: `${total} retry events across the window; one run retried ${worstN} times. Check rate limits / transient tool failures.`,
          traceId: worstTrace,
        });
      }
    }

    if (!cards.length) {
      add({ id: 'healthy', category: 'ok', severity: 'good', title: 'No issues detected', metric: `${failures.runs} runs`, finding: 'No tuning issues flagged in this window.' });
    }

    cards.sort((a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9));

    return {
      from, to,
      insights: cards,
      charts: {
        loopLength: loops.histogram,
        toolStats: tools.map(t => ({ name: t.name, calls: t.calls, errorRate: t.errorRate, p95Ms: t.p95Ms })),
        cacheHitTrend: (() => {
          const byBucket = {};
          cacheRollup.forEach(r => {
            const b = byBucket[r.bucket] || { prompt: 0, cached: 0 };
            b.prompt += r.prompt_tokens; b.cached += r.cached_tokens; byBucket[r.bucket] = b;
          });
          return Object.keys(byBucket).sort().map(bucket => ({
            bucket, rate: byBucket[bucket].prompt ? byBucket[bucket].cached / byBucket[bucket].prompt : 0,
          }));
        })(),
      },
    };
  }

  return { getInsights };
}
