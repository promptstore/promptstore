import { Span } from '../../core/telemetry/canonical';

// Storage abstraction for canonical spans. PostgresSpanStore implements it
// today; a ClickHouseSpanStore can replace it later purely via configuration,
// since ingestion, read, and rollup code depend only on this interface.

export interface TraceSummary {
  trace_id: string;
  workspace_id: number;
  name: string | null;
  status: string;
  start_time: string;
  end_time: string | null;
  duration_ms: number | null;
  span_count: number;
  turns: number;          // # loop.iteration spans
  tool_calls: number;     // # tool.call spans
  prompt_tokens: number;
  completion_tokens: number;
  cached_tokens: number;
  total_tokens: number;
  cost_total: number;
  user_id: string | null;
  session_id: string | null;   // conversation id (raw), for grouping/search
  running: boolean;
  awaiting_user: boolean;       // an open hitl.pause span => suspended on the human
}

export interface ListTracesParams {
  limit?: number;
  offset?: number;
  name?: string;
  from?: string;
  to?: string;
  status?: string;
  sessionId?: string;          // filter to a single conversation
}

export interface CostRollupRow {
  bucket: string;         // date/hour bucket
  group: string;          // grouping dimension value (model/user/...)
  cost: number;
  prompt_tokens: number;
  completion_tokens: number;
  cached_tokens: number;
  reasoning_tokens: number;
  runs: number;
}

export interface CostTotals {
  cost: number;
  prompt_tokens: number;
  completion_tokens: number;
  cached_tokens: number;
  reasoning_tokens: number;
  total_tokens: number;
  runs: number;
}

// current-window totals plus the immediately-preceding equal-length window,
// so the frontend can render period-over-period deltas on the KPI tiles.
export interface CostKpis {
  current: CostTotals;
  previous: CostTotals;
  from: string;
  to: string;
}

export interface CostDistributionRow {
  provider: string;
  model: string;
  cost: number;
  total_tokens: number;
}

export interface SpanStore {
  // Persist a batch of spans (upsert by (trace_id, span_id) so start/end patch).
  writeSpans(spans: Span[]): Promise<void>;

  // All spans for a trace within a workspace, ordered by (seq, start_time).
  // sinceSeq enables incremental polling / live replay.
  getSpans(workspaceId: number, traceId: string, opts?: { sinceSeq?: number }): Promise<Span[]>;

  // Paginated per-trace summaries for the list view.
  listTraces(workspaceId: number, params?: ListTracesParams): Promise<{ count: number; data: TraceSummary[] }>;

  // Delete all spans for the given traces within a workspace. Scoped by
  // workspace so one tenant can never delete another's traces. Returns the
  // number of spans removed.
  deleteTraces(workspaceId: number, traceIds: string[]): Promise<{ spans: number; traces: number }>;

  // Cost/token rollup for dashboards (Phase 4). groupBy: model|user|provider.
  costRollup(workspaceId: number, opts: { from: string; to: string; bucket?: 'day' | 'hour'; groupBy?: string }): Promise<CostRollupRow[]>;

  // KPI totals for [from,to] plus the preceding equal-length window (for deltas).
  costKpis(workspaceId: number, opts: { from: string; to: string }): Promise<CostKpis>;

  // Cost + tokens grouped by provider→model, for the distribution sunburst.
  costDistribution(workspaceId: number, opts: { from: string; to: string }): Promise<CostDistributionRow[]>;

  // Sum of model-call cost in [from,to] — used by budget status.
  costInWindow(workspaceId: number, opts: { from: string; to: string }): Promise<number>;

  // Close spans left open (end_time IS NULL) in traces with no ingest activity
  // for `olderThanMs` — an emitter that died/was orphaned before its teardown
  // ran (e.g. a detached sub-agent worker thread when its stream closed) leaves
  // spans "running" forever, since a trace ends only when its root span gets an
  // end event. Marks them status='error' so they're distinguishable from clean
  // completions. Returns { spans, traces } reaped.
  reapStaleSpans(olderThanMs: number): Promise<{ spans: number; traces: number }>;
}
