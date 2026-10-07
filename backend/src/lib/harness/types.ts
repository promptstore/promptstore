/**
 * Agent harness core types.
 *
 * This library is deliberately free of promptstore imports. Design follows
 * the pi agent-core (earendil-works/pi, packages/agent): a provider-agnostic
 * StreamFn, a turn loop with a tool-execution pipeline and hooks, and an
 * event stream that subscribers use for state, persistence and telemetry.
 */

// ---------------------------------------------------------------- content

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ThinkingContent {
  type: 'thinking';
  thinking: string;
}

export interface ImageContent {
  type: 'image';
  /** base64 data or a URL */
  data: string;
  mimeType?: string;
  url?: string;
}

export interface ToolCall {
  type: 'toolCall';
  id: string;
  name: string;
  arguments: Record<string, any>;
}

// ---------------------------------------------------------------- usage

export interface Usage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  cost: number;
}

// ---------------------------------------------------------------- messages

export type StopReason = 'stop' | 'length' | 'toolUse' | 'error' | 'aborted';

export interface UserMessage {
  role: 'user';
  content: string | (TextContent | ImageContent)[];
  timestamp: number;
}

export interface AssistantMessage {
  role: 'assistant';
  content: (TextContent | ThinkingContent | ToolCall)[];
  provider?: string;
  model?: string;
  usage: Usage;
  stopReason: StopReason;
  errorMessage?: string;
  timestamp: number;
  durationMs?: number;
}

export interface ToolResultMessage<TDetails = any> {
  role: 'toolResult';
  toolCallId: string;
  toolName: string;
  content: (TextContent | ImageContent)[];
  details?: TDetails;
  isError: boolean;
  timestamp: number;
  durationMs?: number;
}

/**
 * Application-defined message (e.g. compaction summaries). Not sent to the
 * model unless `convertToLlm` maps it to an LLM message.
 */
export interface CustomMessage {
  role: 'custom';
  customType: string;
  content: string;
  details?: any;
  timestamp: number;
}

/** Messages the model understands. */
export type LlmMessage = UserMessage | AssistantMessage | ToolResultMessage;

/** Messages kept in the harness transcript. */
export type HarnessMessage = LlmMessage | CustomMessage;

// ---------------------------------------------------------------- tools

export interface ToolResult<TDetails = any> {
  content: (TextContent | ImageContent)[];
  details?: TDetails;
  isError?: boolean;
  /** Stop the loop after this batch (only if every result in the batch terminates). */
  terminate?: boolean;
  usage?: Usage;
}

export type ToolUpdateCallback<TDetails = any> = (partial: ToolResult<TDetails>) => void;

export type ToolExecutionMode = 'sequential' | 'parallel';

export interface HarnessTool<TArgs = any, TDetails = any> {
  name: string;
  description: string;
  /** JSON Schema for the arguments object. */
  parameters: Record<string, any>;
  label?: string;
  /** Forces the whole batch to run sequentially when this tool is called. */
  executionMode?: ToolExecutionMode;
  /** Normalise raw arguments before validation. */
  prepareArguments?: (args: unknown) => TArgs;
  execute: (
    toolCallId: string,
    args: TArgs,
    signal?: AbortSignal,
    onUpdate?: ToolUpdateCallback<TDetails>,
  ) => Promise<ToolResult<TDetails>>;
}

// ---------------------------------------------------------------- context

export interface HarnessContext {
  systemPrompt?: string;
  messages: HarnessMessage[];
  tools?: HarnessTool[];
}

/** What the StreamFn receives: only LLM messages. */
export interface LlmContext {
  systemPrompt?: string;
  messages: LlmMessage[];
  tools?: HarnessTool[];
}

// ---------------------------------------------------------------- streaming

export type AssistantMessageEvent =
  | { type: 'start'; partial: AssistantMessage }
  | { type: 'text_delta'; contentIndex: number; delta: string; partial: AssistantMessage }
  | { type: 'thinking_delta'; contentIndex: number; delta: string; partial: AssistantMessage }
  | { type: 'toolcall_end'; contentIndex: number; toolCall: ToolCall; partial: AssistantMessage }
  | { type: 'done'; reason: 'stop' | 'length' | 'toolUse'; message: AssistantMessage }
  | { type: 'error'; reason: 'error' | 'aborted'; error: AssistantMessage };

export interface StreamOptions {
  signal?: AbortSignal;
  [key: string]: any;
}

/**
 * Provider adapter. Contract: once a stream is returned it must never throw;
 * failures are reported as a final `error` event carrying an AssistantMessage
 * with stopReason 'error' | 'aborted'.
 */
export type StreamFn = (
  context: LlmContext,
  options?: StreamOptions,
) => AsyncIterable<AssistantMessageEvent> | Promise<AsyncIterable<AssistantMessageEvent>>;

// ---------------------------------------------------------------- events

export type AgentEvent =
  | { type: 'agent_start' }
  | { type: 'agent_end'; messages: HarnessMessage[] }
  | { type: 'turn_start'; turn: number }
  /** The transcript was replaced (e.g. by compaction in prepareNextTurn). */
  | { type: 'context_replaced'; messages: HarnessMessage[] }
  | { type: 'turn_end'; turn: number; message: AssistantMessage; toolResults: ToolResultMessage[] }
  | { type: 'message_start'; message: HarnessMessage }
  | { type: 'message_update'; message: AssistantMessage; assistantMessageEvent: AssistantMessageEvent }
  | { type: 'message_end'; message: HarnessMessage }
  | { type: 'tool_execution_start'; toolCallId: string; toolName: string; args: any }
  | { type: 'tool_execution_update'; toolCallId: string; toolName: string; args: any; partialResult: ToolResult }
  | { type: 'tool_execution_end'; toolCallId: string; toolName: string; args: any; result: ToolResult; isError: boolean; durationMs: number };

export type AgentEventSink = (event: AgentEvent) => void | Promise<void>;

// ---------------------------------------------------------------- hooks

export interface BeforeToolCallContext {
  assistantMessage: AssistantMessage;
  toolCall: ToolCall;
  args: any;
  context: HarnessContext;
}

export interface BeforeToolCallResult {
  block?: boolean;
  reason?: string;
  terminate?: boolean;
}

export interface AfterToolCallContext {
  assistantMessage: AssistantMessage;
  toolCall: ToolCall;
  args: any;
  result: ToolResult;
  isError: boolean;
  context: HarnessContext;
}

/** Field-level replacement of the tool result. */
export type AfterToolCallResult = Partial<Pick<ToolResult, 'content' | 'details' | 'isError' | 'terminate'>>;

export interface TurnContext {
  turn: number;
  message: AssistantMessage;
  toolResults: ToolResultMessage[];
  context: HarnessContext;
  newMessages: HarnessMessage[];
}

export type TurnDecision = { action: 'continue' } | { action: 'end'; reason?: string };

export type FinishTurn = (
  turn: TurnContext,
  signal?: AbortSignal,
) => TurnDecision | void | Promise<TurnDecision | void>;

export interface TurnUpdate {
  /** Replace the context (e.g. after compaction). */
  context?: HarnessContext;
  /** Append messages before the next model call. */
  messages?: HarnessMessage[];
}

export interface AgentLoopConfig {
  /** Map transcript messages to LLM messages. Default drops `custom` messages. */
  convertToLlm?: (messages: HarnessMessage[]) => LlmMessage[] | Promise<LlmMessage[]>;
  /** Rewrite the transcript before each model call (pruning, injection). Must not throw. */
  transformContext?: (messages: HarnessMessage[], signal?: AbortSignal) => Promise<HarnessMessage[]>;
  /** Called before every provider request; may return a replacement context. */
  prepareRequest?: (context: HarnessContext, signal?: AbortSignal) => Promise<HarnessContext | void> | HarnessContext | void;
  /** Called after turn_end, before the next turn. Compaction hook point. */
  prepareNextTurn?: (turn: TurnContext, signal?: AbortSignal) => Promise<TurnUpdate | void> | TurnUpdate | void;
  finishTurn?: FinishTurn;
  getSteeringMessages?: () => Promise<HarnessMessage[]>;
  getFollowUpMessages?: () => Promise<HarnessMessage[]>;
  /** Default 'parallel'. */
  toolExecution?: ToolExecutionMode;
  beforeToolCall?: (ctx: BeforeToolCallContext, signal?: AbortSignal) => Promise<BeforeToolCallResult | void>;
  afterToolCall?: (ctx: AfterToolCallContext, signal?: AbortSignal) => Promise<AfterToolCallResult | void>;
  /** Extra options passed through to the StreamFn. */
  streamOptions?: Omit<StreamOptions, 'signal'>;
}
