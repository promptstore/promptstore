import type { AgentEvent, CompactionSettings, HarnessLimits, ToolExecutionMode } from '../../lib/harness';

export type HarnessToolType = 'tool' | 'function' | 'composition' | 'agent' | 'index' | 'mcp';

/** A tool reference in an implementation's harness config. */
export interface HarnessToolRef {
  type: HarnessToolType;
  /**
   * tool key (plugin), function id, composition id, agent id, index name, or
   * for MCP: `<serverId>` (every tool on the server) or `<serverId>/<toolName>`
   */
  key: string;
}

/** `implementations[].harness` as stored in `functions.val`. */
export interface HarnessConfig extends HarnessLimits {
  enabled: boolean;
  tools?: HarnessToolRef[];
  toolExecution?: ToolExecutionMode;
  compaction?: Partial<CompactionSettings>;
}

/** Per-run context, passed through semantic function `options.harness`. */
export interface HarnessRunOptions {
  workspaceId?: number;
  username?: string;
  /** Persist and resume the conversation in this session. */
  sessionId?: string;
  /** Abort the run (e.g. client disconnected). */
  signal?: AbortSignal;
  /** Receive harness events (e.g. for SSE streaming). */
  onEvent?: (event: AgentEvent) => void | Promise<void>;
  /** Parent trace for nested runs (a harness calling a harness function). */
  parentTraceId?: string;
  parentSpanId?: string;
}

export interface HarnessRunMetadata {
  traceId: string;
  sessionId?: string;
  turns: number;
  toolCalls: number;
  stopReason: string;
  stoppedBy?: string;
  errorMessage?: string;
}

export const DEFAULT_HARNESS_LIMITS: HarnessLimits = {
  maxTurns: 10,
  maxDurationMs: 5 * 60 * 1000,
};

// ---------------------------------------------------------------- callbacks

export interface HarnessOnStartResponse {
  name: string;
  tools: string[];
  config: HarnessConfig;
  traceId: string;
  sessionId?: string;
}

export interface HarnessOnEndResponse {
  name: string;
  metadata: HarnessRunMetadata & { totalCostUsd: number };
  errors?: any;
}

export interface HarnessTurnOnStartResponse {
  name: string;
  turn: number;
}

export interface HarnessTurnOnEndResponse {
  name: string;
  turn: number;
  stopReason: string;
  errorMessage?: string;
}

export interface HarnessToolCallResponse {
  name: string;
  toolName: string;
  toolCallId: string;
  args: any;
  result: any;
  isError: boolean;
  durationMs: number;
}
