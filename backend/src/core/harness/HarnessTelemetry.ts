import { randomBytes } from 'crypto';

import { ContextEventName, Span, SpanKind, SpanStatus } from '../telemetry/canonical';
import type { AgentEvent, AssistantMessage, CompactionResult, LlmContext, LlmMessage } from '../../lib/harness';

/** Classifies each message sent to the model, for the context window breakdown. */
export type ContextClassifier = (message: LlmMessage, index: number) => string;

interface ModelInput {
  context: LlmContext;
  classify?: ContextClassifier;
}

const SOURCE_LABELS: Record<string, string> = {
  system: 'System prompt',
  tools: 'Tool definitions',
  history: 'Prior conversation',
  prompt: 'Prompt',
  user: 'User messages',
  assistant: 'Assistant turns',
  tool_result: 'Tool results',
  summary: 'Compaction summary',
};

const PREVIEW_CHARS = 200;

function messageText(m: LlmMessage): string {
  if (typeof m.content === 'string') return m.content;
  return (m.content as any[])
    .map((c) => {
      if (c.type === 'text') return c.text;
      if (c.type === 'thinking') return c.thinking;
      if (c.type === 'toolCall') return `${c.name}(${JSON.stringify(c.arguments)})`;
      if (c.type === 'image') return '[image]';
      return '';
    })
    .join('\n');
}

/** Serializable copy of what the model was sent. */
function inputPayload(ctx: LlmContext) {
  return {
    system: ctx.systemPrompt,
    messages: ctx.messages.map((m) => {
      if (m.role === 'toolResult') {
        return { role: 'tool', toolCallId: m.toolCallId, name: m.toolName, content: messageText(m), isError: m.isError };
      }
      return { role: m.role, content: m.content };
    }),
    tools: (ctx.tools || []).map((t) => t.name),
  };
}

export interface TelemetryIngest {
  ingest(spans: Span[], opts: { workspaceId: number; username?: string }): Promise<{ accepted: number; dropped: number }>;
}

export interface HarnessTelemetryParams {
  ingestService?: TelemetryIngest;
  logger: any;
  workspaceId: number;
  username?: string;
  name: string;
  provider: string;
  model: string;
  sessionId?: string;
  parentTraceId?: string;
  parentSpanId?: string;
  attributes?: Record<string, any>;
  /** Capture prompts / tool args and results as span content (offloaded to the payload store). */
  captureContent?: boolean;
  /** Model context window, for window utilization in context events. */
  contextWindow?: number;
}

const hex = (bytes: number) => randomBytes(bytes).toString('hex');
const now = () => new Date().toISOString();

/**
 * Maps harness AgentEvents to canonical spans and ingests them in-process,
 * so internal harness runs appear in the harness trace views exactly like
 * runs reported by external SDKs:
 *
 *   harness.run
 *     loop.iteration (per turn)
 *       model.call
 *       tool.call (per tool call)
 */
export class HarnessTelemetry {

  readonly traceId: string;
  readonly rootSpanId: string;

  private readonly p: HarnessTelemetryParams;
  private root: Span;
  private iteration?: Span;
  private model?: Span;
  private tools = new Map<string, Span>();
  private queue: Promise<any> = Promise.resolve();
  private pendingInput?: ModelInput;

  constructor(params: HarnessTelemetryParams) {
    this.p = params;
    // nested runs join the parent's trace
    this.traceId = params.parentTraceId || hex(16);
    this.rootSpanId = hex(8);
    this.root = this.span(SpanKind.HarnessRun, params.name, params.parentSpanId || null, {
      'ps.harness': 'promptstore',
      'gen_ai.system': params.provider,
      'gen_ai.request.model': params.model,
      ...params.attributes,
    });
    this.root.span_id = this.rootSpanId;
  }

  /**
   * Record what is about to be sent to the model. Call from a StreamFn
   * wrapper: it is the exact context after transformContext / convertToLlm.
   */
  recordModelInput(context: LlmContext, classify?: ContextClassifier) {
    this.pendingInput = { context, classify };
  }

  /** Run-level input and output, shown on the root span. */
  setRunContent(content: { input?: any; output?: any }) {
    if (!this.p.captureContent) return;
    (this.root as any).content = { ...(this.root as any).content, ...content };
  }

  /** Subscriber for Agent.subscribe / loop emit. */
  readonly onEvent = (event: AgentEvent) => {
    switch (event.type) {
      case 'agent_start':
        this.write(this.root);
        break;
      case 'turn_start':
        this.iteration = this.span(SpanKind.LoopIteration, `turn ${event.turn}`, this.rootSpanId, { 'ps.turn': event.turn });
        this.write(this.iteration);
        break;
      case 'message_start':
        if (event.message.role === 'assistant' && this.iteration && !this.model) {
          this.model = this.span(SpanKind.ModelCall, `${this.p.provider}/${this.p.model}`, this.iteration.span_id, {});
          this.model.provider = this.p.provider;
          this.model.request_model = this.p.model;
          // backdate to the request start when the stream reports a duration
          const ms = (event.message as AssistantMessage).durationMs;
          if (ms) this.model.start_time = new Date(Date.now() - ms).toISOString();
        }
        break;
      case 'message_end':
        if (event.message.role === 'assistant' && this.model) {
          const m = event.message;
          this.model.response_model = m.model || this.p.model;
          this.model.usage = {
            prompt_tokens: m.usage?.input || 0,
            completion_tokens: m.usage?.output || 0,
            total_tokens: m.usage?.totalTokens || 0,
            cached_tokens: m.usage?.cacheRead || 0,
          };
          this.model.attributes = {
            ...this.model.attributes,
            'ps.stop_reason': m.stopReason,
            'ps.tool_calls': m.content.filter((c) => c.type === 'toolCall').length,
          };
          const input = this.pendingInput;
          this.pendingInput = undefined;
          if (this.p.captureContent) {
            (this.model as any).content = {
              ...(input && { input: inputPayload(input.context) }),
              output: m.content,
            };
          }
          if (input) this.recordAssemble(input, m.usage?.input || 0);
          this.end(this.model, m.stopReason === 'error' || m.stopReason === 'aborted' ? m.errorMessage || m.stopReason : undefined);
          this.model = undefined;
        }
        break;
      case 'tool_execution_start': {
        const s = this.span(SpanKind.ToolCall, event.toolName, this.iteration?.span_id || this.rootSpanId, {
          'gen_ai.tool.name': event.toolName,
          'gen_ai.tool.call.id': event.toolCallId,
        });
        this.tools.set(event.toolCallId, s);
        break;
      }
      case 'tool_execution_end': {
        const s = this.tools.get(event.toolCallId);
        if (!s) break;
        this.tools.delete(event.toolCallId);
        s.attributes = { ...s.attributes, 'ps.is_error': event.isError, 'ps.duration_ms': event.durationMs };
        if (this.p.captureContent) {
          (s as any).content = { input: event.args, output: event.result?.content };
        }
        const msg = event.isError
          ? event.result?.content?.map((c: any) => c.text).filter(Boolean).join('\n').slice(0, 500) || 'tool error'
          : undefined;
        this.end(s, msg);
        break;
      }
      case 'turn_end':
        if (this.iteration) {
          const err = event.message.stopReason === 'error' || event.message.stopReason === 'aborted';
          this.end(this.iteration, err ? event.message.errorMessage || event.message.stopReason : undefined);
          this.iteration = undefined;
        }
        break;
    }
  };

  /**
   * ps.context.assemble on the turn span: the window broken down by source.
   * Per-source sizes are chars/4 estimates, scaled to the provider-reported
   * prompt tokens when available.
   */
  private recordAssemble({ context, classify }: ModelInput, reportedTokens: number) {
    const target = this.iteration || this.root;
    const order: string[] = [];
    const bySource = new Map<string, { chars: number; count: number; preview: string }>();
    const add = (source: string, text: string) => {
      if (!text) return;
      let seg = bySource.get(source);
      if (!seg) {
        seg = { chars: 0, count: 0, preview: text.slice(0, PREVIEW_CHARS) };
        bySource.set(source, seg);
        order.push(source);
      }
      seg.chars += text.length;
      seg.count += 1;
    };
    add('system', context.systemPrompt || '');
    if (context.tools?.length) {
      add('tools', context.tools.map((t) => `${t.name}: ${t.description}\n${JSON.stringify(t.parameters)}`).join('\n'));
    }
    context.messages.forEach((m, i) => {
      const source = classify?.(m, i) || (m.role === 'toolResult' ? 'tool_result' : m.role);
      add(source, messageText(m));
    });

    const estimated = [...bySource.values()].reduce((a, s) => a + Math.ceil(s.chars / 4), 0) || 1;
    const scale = reportedTokens > 0 ? reportedTokens / estimated : 1;
    const sources = order.map((source) => {
      const seg = bySource.get(source)!;
      const label = SOURCE_LABELS[source] || source;
      return {
        source,
        label: seg.count > 1 ? `${label} (${seg.count})` : label,
        tokens: Math.round(Math.ceil(seg.chars / 4) * scale),
        preview: seg.preview,
      };
    });
    const total = sources.reduce((a, s) => a + s.tokens, 0);
    target.events = [
      ...(target.events || []),
      {
        name: ContextEventName.Assemble,
        time: now(),
        attributes: {
          turn: Number(target.attributes?.['ps.turn']) || undefined,
          sources,
          window_tokens_after: total,
          window_limit: this.p.contextWindow || undefined,
          reason: 'model request',
        },
      },
    ];
  }

  /** Record a compaction as a context event on the root span. */
  recordCompaction(turn: number, result: CompactionResult, windowLimit?: number) {
    const tokensAfter = Math.ceil(result.summary.content.length / 4);
    this.root.events = [
      ...(this.root.events || []),
      {
        name: ContextEventName.Compact,
        time: now(),
        attributes: {
          turn,
          method: 'summarize',
          window_tokens_before: result.tokensBefore,
          window_tokens_after: tokensAfter,
          window_limit: windowLimit,
          tokens_reclaimed: Math.max(0, result.tokensBefore - tokensAfter),
        },
      },
    ];
  }

  /** Close the root span and wait for all writes. */
  async finish({ stopReason, errorMessage, attributes }: { stopReason: string; errorMessage?: string; attributes?: Record<string, any> }) {
    // close anything left open (e.g. aborted mid-tool)
    for (const s of this.tools.values()) this.end(s, 'aborted');
    this.tools.clear();
    if (this.model) this.end(this.model, 'aborted');
    if (this.iteration) this.end(this.iteration, 'aborted');
    this.root.attributes = { ...this.root.attributes, ...attributes, 'ps.stop_reason': stopReason };
    this.end(this.root, errorMessage);
    await this.queue;
  }

  private span(kind: SpanKind, name: string, parent: string | null, attributes: Record<string, any>): Span {
    return {
      trace_id: this.traceId,
      span_id: hex(8),
      parent_span_id: parent,
      workspace_id: this.p.workspaceId,
      span_kind: kind,
      name,
      start_time: now(),
      end_time: null,
      status: SpanStatus.Unset,
      attributes,
      session_id: this.p.sessionId || null,
      user_id: this.p.username || null,
      sdk_version: 'promptstore-harness/1',
    };
  }

  private end(span: Span, errorMessage?: string) {
    span.end_time = now();
    span.status = errorMessage ? SpanStatus.Error : SpanStatus.Ok;
    span.status_message = errorMessage || null;
    this.write(span);
  }

  /** Serialized, best-effort writes: telemetry never fails the run. */
  private write(span: Span) {
    const { ingestService, workspaceId, username, logger } = this.p;
    if (!ingestService || workspaceId == null) return;
    // snapshot: the span object keeps mutating
    const snapshot = structuredClone(span);
    this.queue = this.queue
      .then(() => ingestService.ingest([snapshot], { workspaceId, username }))
      .catch((err) => logger.error('HarnessTelemetry: ingest failed:', err.message));
  }
}
