// Canonical span/event model for agentic-harness observability.
//
// This is the single, unified telemetry schema that replaces both legacy trace
// trees (core/tracing/Tracer.ts and agents/AgentTracingCallback.ts). Spans are
// stored FLAT (keyed by span_id); the tree is reconstructed on read from
// parent_span_id. The model is aligned with the OpenTelemetry data model
// (trace/span/event/link) so an OTLP wire adapter can be added later without a
// remodel, while the `ps.*` attribute/event overlay carries harness-specific
// fidelity the OTel GenAI conventions do not (yet) standardize.
//
// Token fields mirror the RosettaStone usage vocabulary (see
// core/conversions/RosettaStone.ts: ChatCompletionUsage, PromptTokensDetails,
// CompletionTokensDetails) verbatim so cost/analytics reuse one vocabulary.

// Reserved attribute namespaces:
//   gen_ai.*  — OTel GenAI semantic conventions (mapped where they fit)
//   ps.*      — promptstore semantic overlay (harness-specific)

export enum SpanKind {
  HarnessRun = 'harness.run',        // top-level run root
  LoopIteration = 'loop.iteration',  // one turn of an agent loop
  ModelCall = 'model.call',          // an LLM request/response
  ToolCall = 'tool.call',            // a tool/function invocation
  SubagentSpawn = 'subagent.spawn',  // a spawned sub-agent (links to child trace)
  HitlPause = 'hitl.pause',          // a turn-level pause awaiting human input (HITL); child of the run root
  CompositionCall = 'composition.call',
  FunctionCall = 'function.call',
  PromptRender = 'prompt.render',
  ContextOp = 'context.op',          // a context-window mutation batch
  Retrieval = 'retrieval',           // RAG / enrichment / search
  Evaluation = 'evaluation',
  Guardrail = 'guardrail',
  Custom = 'custom',
}

export enum SpanStatus {
  Unset = 'unset',
  Ok = 'ok',
  Error = 'error',
}

// Relationship carried on a span link (ps.link.rel). Expresses causality that
// plain parent/child nesting cannot (sub-agents run in separate traces/processes).
export enum LinkRel {
  Spawns = 'spawns',
  SpawnedBy = 'spawned_by',
  Resumes = 'resumes',
  Retries = 'retries',
  FollowsFrom = 'follows_from',
}

export interface SpanLink {
  trace_id: string;
  span_id?: string;
  rel: LinkRel | string;
}

// A point-in-time event within a span. Context-lifecycle events use the
// reserved names below and carry a ContextEventPayload in `attributes`.
export interface SpanEvent {
  name: string;                 // e.g. 'ps.context.compact', 'ps.tool.result', 'ps.retry'
  time: string;                 // ISO-8601
  attributes?: Record<string, any>;
}

export const ContextEventName = {
  Assemble: 'ps.context.assemble',
  Retrieve: 'ps.context.retrieve',
  Compact: 'ps.context.compact',
  Evict: 'ps.context.evict',
} as const;

export interface ContextSegment {
  source: string;               // 'system' | 'instructions' | 'history' | 'retrieved' | 'tool_result' | 'scratchpad' | ...
  ref?: string;
  tokens: number;
  label?: string;
  preview?: string;
}

// Payload for a context-lifecycle event — carries token deltas + before/after
// window state so the frontend can reconstruct window utilization over the run.
export interface ContextEventPayload {
  turn?: number;
  sources?: ContextSegment[];       // full window composition after the op
  window_tokens_before?: number;
  window_tokens_after?: number;
  window_limit?: number;
  tokens_reclaimed?: number;        // for compact
  tokens_evicted?: number;          // for evict
  items_evicted?: number;
  added_ids?: string[];
  dropped_ids?: string[];
  summarized_from?: string[];
  summarized_into?: string;
  method?: string;                  // 'summarize' | 'truncate' | 'dedupe'
  policy?: string;                  // 'lru' | 'relevance' | 'age'
  reason?: string;
}

// Token usage on a model.call span. Mirrors RosettaStone ChatCompletionUsage.
export interface SpanUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cached_tokens?: number;           // prompt_tokens_details.cached_tokens
  reasoning_tokens?: number;        // completion_tokens_details.reasoning_tokens
}

// The canonical span. `end_time == null` means the span is in-flight (live).
export interface Span {
  trace_id: string;
  span_id: string;
  parent_span_id?: string | null;
  workspace_id: number;
  span_kind: SpanKind | string;
  name?: string;
  start_time: string;               // ISO-8601
  end_time?: string | null;         // null => running
  status?: SpanStatus | string;
  status_message?: string | null;

  provider?: string | null;
  request_model?: string | null;
  response_model?: string | null;

  usage?: SpanUsage;                // convenience; flattened to columns on write

  // cost is computed server-side at ingest; SDKs need not send it
  cost_input?: number | null;
  cost_output?: number | null;
  cost_total?: number | null;
  currency?: string;

  attributes?: Record<string, any>;
  events?: SpanEvent[];
  links?: SpanLink[];
  payload_ref?: string | null;      // MinIO key for large in/out payloads

  session_id?: string | null;
  user_id?: string | null;
  sdk_version?: string | null;
  seq?: number | null;              // monotonic per trace, for ordering/replay
}

// A node in the reconstructed trace tree (returned by SpanReadService).
export interface SpanNode extends Span {
  children: SpanNode[];
}

// Batch envelope accepted by POST /v1/telemetry/spans.
export interface SpanBatch {
  spans: Span[];
  // workspace_id is ignored here — it is always bound from the API key.
}
