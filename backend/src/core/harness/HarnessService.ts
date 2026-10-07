import { Callback } from '../callbacks/Callback';
import { ChatResponse, Message, MessageRole, ModelParams, convertContentTypeToString } from '../conversions/RosettaStone';
import { LLMModel } from '../models/llm_types';
import {
  Agent,
  COMPACTION_SUMMARY_TYPE,
  DEFAULT_COMPACTION_SETTINGS,
  SUMMARY_PROMPT,
  compact,
  defaultConvertToLlm,
  buildSessionContext,
  estimateContextTokens,
  shouldCompact,
  summaryToLlm,
  totalUsage,
  withLimits,
} from '../../lib/harness';
import type {
  AgentEvent,
  AssistantMessage,
  CompactionSettings,
  CustomMessage,
  HarnessMessage,
  HarnessTool,
  LlmMessage,
  SessionStore,
  ToolCall,
  TurnContext,
  TurnUpdate,
} from '../../lib/harness';
import { fromRosettaMessages, toChatResponse } from './conversions';
import { HarnessTelemetry, TelemetryIngest } from './HarnessTelemetry';
import { createModelStreamFn, PriceUsage } from './ModelStreamFn';
import { ToolResolverService } from './ToolResolver';
import {
  DEFAULT_HARNESS_LIMITS,
  HarnessConfig,
  HarnessRunMetadata,
  HarnessRunOptions,
} from './types';

export const OUTPUT_TOOL_NAME = 'output_formatter';

export interface HarnessSessionStore extends SessionStore {
  ensureSession(sessionId: string, opts: { workspaceId: number; functionId?: string; username?: string }): Promise<boolean>;
}

export interface HarnessServiceDeps {
  logger: any;
  toolResolver: ToolResolverService;
  telemetryIngestService?: TelemetryIngest;
  pricingService?: { computeCost(p: { model: string; usage: any; workspaceId?: number }): Promise<{ cost_total: number } | null> };
  sessionStore?: HarnessSessionStore;
}

export interface HarnessRunParams {
  /** Semantic function name (run span name). */
  name: string;
  functionId?: string;
  model: LLMModel;
  provider: string;
  modelKey: string;
  modelParams: Partial<ModelParams>;
  systemPrompt?: string;
  history?: Message[];
  prompts: Message[];
  config: HarnessConfig;
  returnTypeSchema?: object;
  /** Caller-supplied tools (e.g. `functions` passed to the execution). */
  extraTools?: HarnessTool[];
  callbacks?: Callback[];
  run?: HarnessRunOptions;
}

export interface HarnessRunResult {
  response: ChatResponse;
  responseMetadata: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    harness: HarnessRunMetadata & { totalCostUsd: number };
    harnessMessages: HarnessMessage[];
  };
}

/**
 * Runs a semantic function implementation as an agent harness: the
 * multi-turn loop from lib/harness wired to promptstore models, tools,
 * sessions, telemetry and callbacks.
 */
export function HarnessService({
  logger,
  toolResolver,
  telemetryIngestService,
  pricingService,
  sessionStore,
}: HarnessServiceDeps) {

  async function run(params: HarnessRunParams): Promise<HarnessRunResult> {
    const {
      name,
      functionId,
      model,
      provider,
      modelKey,
      modelParams,
      history,
      prompts,
      config,
      returnTypeSchema,
      extraTools = [],
      callbacks = [],
      run: runOpts = {},
    } = params;
    const { workspaceId, username, sessionId } = runOpts;

    const telemetry = new HarnessTelemetry({
      ingestService: telemetryIngestService,
      logger,
      workspaceId,
      username,
      name,
      provider,
      model: modelKey,
      sessionId,
      parentTraceId: runOpts.parentTraceId,
      parentSpanId: runOpts.parentSpanId,
      attributes: { 'ps.function_id': functionId, 'ps.function_name': name },
      captureContent: true,
      contextWindow: model.contextWindow,
    });

    // ----- tools
    const tools: HarnessTool[] = [
      ...await toolResolver.resolveTools(config.tools, { ...runOpts, parentTraceId: telemetry.traceId }),
      ...extraTools,
    ];
    let systemPrompt = params.systemPrompt;
    if (returnTypeSchema) {
      tools.push(outputTool(returnTypeSchema));
      systemPrompt = [
        systemPrompt,
        `When you have the final answer, call the ${OUTPUT_TOOL_NAME} tool with it. Do not reply in plain text.`,
      ].filter(Boolean).join('\n\n');
    }

    // ----- context (session or history)
    let initialMessages: HarnessMessage[];
    const entryIds = new Map<HarnessMessage, string>();
    const useSession = !!(sessionId && sessionStore && workspaceId != null);
    if (useSession) {
      const owned = await sessionStore.ensureSession(sessionId, { workspaceId, functionId, username });
      if (!owned) {
        throw new Error(`Session ${sessionId} belongs to another workspace`);
      }
      const [entries, leafId] = await Promise.all([
        sessionStore.getEntries(sessionId),
        sessionStore.getLeafId(sessionId),
      ]);
      // buildSessionContext returns the entries' own message objects, so they
      // can be mapped back to entry ids by identity (for compaction checkpoints)
      for (const e of entries) {
        if (e.type === 'message') entryIds.set(e.message, e.id);
      }
      initialMessages = buildSessionContext(entries, leafId).messages;
    } else {
      initialMessages = fromRosettaMessages(history);
    }

    // ----- limits and compaction
    const limits = withLimits({
      maxTurns: config.maxTurns ?? DEFAULT_HARNESS_LIMITS.maxTurns,
      maxDurationMs: config.maxDurationMs ?? DEFAULT_HARNESS_LIMITS.maxDurationMs,
      maxCostUsd: config.maxCostUsd,
    }, undefined, runOpts.signal);

    const compaction: CompactionSettings = { ...DEFAULT_COMPACTION_SETTINGS, ...config.compaction };
    const contextWindow = model.contextWindow || 0;

    const summarize = async (conversation: string, previousSummary?: string) => {
      const { response } = await model.call({
        provider,
        callbacks,
        skipCache: true,
        request: {
          model: modelKey,
          model_params: { max_tokens: 2048 },
          prompt: {
            context: { system_prompt: SUMMARY_PROMPT },
            messages: [{
              role: MessageRole.user,
              content: (previousSummary ? `Previous summary:\n${previousSummary}\n\n` : '') +
                `Conversation:\n${conversation}`,
            }],
          },
        },
      });
      return convertContentTypeToString(response.choices[0].message.content);
    };

    const prepareNextTurn = async (turn: TurnContext, signal?: AbortSignal): Promise<TurnUpdate | void> => {
      if (!compaction.enabled || !contextWindow) return;
      const tokens = estimateContextTokens(turn.context.messages);
      if (!shouldCompact(tokens, contextWindow, compaction)) return;
      try {
        const result = await compact(turn.context.messages, compaction, summarize, signal);
        if (!result) return;
        telemetry.recordCompaction(turn.turn, result, contextWindow);
        if (useSession) {
          const firstKept = turn.context.messages[result.firstKeptIndex];
          const firstKeptEntryId = entryIds.get(firstKept);
          if (firstKeptEntryId) {
            await sessionStore.append(sessionId, {
              type: 'compaction',
              summary: result.summary,
              firstKeptEntryId,
              tokensBefore: result.tokensBefore,
            });
          }
        }
        return { context: { ...turn.context, messages: result.messages } };
      } catch (err) {
        logger.error('Harness compaction failed:', err.message);
      }
    };

    // classify what each request carries, for the trace's context view
    const promptMessages = fromRosettaMessages(prompts);
    const historySet = new Set<HarnessMessage>(initialMessages);
    const promptSet = new Set<HarnessMessage>(promptMessages);
    const summarySet = new WeakSet<LlmMessage>();
    const classify = (m: LlmMessage) => {
      if (summarySet.has(m)) return 'summary';
      if (historySet.has(m)) return 'history';
      if (promptSet.has(m)) return 'prompt';
      return m.role === 'toolResult' ? 'tool_result' : m.role;
    };

    const convertToLlm = (messages: HarnessMessage[]): LlmMessage[] => {
      const out: LlmMessage[] = [];
      for (const m of messages) {
        if (m.role === 'custom') {
          if (m.customType === COMPACTION_SUMMARY_TYPE) {
            const summary = summaryToLlm(m as CustomMessage);
            summarySet.add(summary);
            out.push(summary);
          }
        } else {
          out.push(...defaultConvertToLlm([m]));
        }
      }
      return out;
    };

    // ----- agent
    const modelStreamFn = createModelStreamFn({
      model,
      provider,
      modelKey,
      modelParams,
      callbacks,
      priceUsage: pricer(workspaceId),
    });
    const agent = new Agent({
      // record the exact request (after transformContext / convertToLlm) for tracing
      streamFn: (context, options) => {
        telemetry.recordModelInput(context, classify);
        return modelStreamFn(context, options);
      },
      systemPrompt,
      tools,
      messages: initialMessages,
      toolExecution: config.toolExecution,
      convertToLlm,
      finishTurn: limits.finishTurn,
      prepareNextTurn,
      signal: limits.signal,
    });

    const newMessages: HarnessMessage[] = [];
    let turns = 0;
    let toolCalls = 0;
    let openTurn = false;

    agent.subscribe(telemetry.onEvent);
    agent.subscribe(async (event: AgentEvent) => {
      switch (event.type) {
        case 'message_end':
          newMessages.push(event.message);
          if (useSession) {
            try {
              const entry = await sessionStore.append(sessionId, { type: 'message', message: event.message });
              entryIds.set(event.message, entry.id);
            } catch (err) {
              logger.error('Harness: session append failed:', err.message);
            }
          }
          break;
        case 'turn_start':
          turns = event.turn;
          openTurn = true;
          notify(callbacks, 'onHarnessTurnStart', { name, turn: event.turn });
          break;
        case 'tool_execution_end':
          toolCalls += 1;
          notify(callbacks, 'onHarnessToolCall', {
            name,
            toolName: event.toolName,
            toolCallId: event.toolCallId,
            args: event.args,
            result: event.result?.content,
            isError: event.isError,
            durationMs: event.durationMs,
          });
          break;
        case 'turn_end':
          if (openTurn) {
            openTurn = false;
            notify(callbacks, 'onHarnessTurnEnd', {
              name,
              turn: event.turn,
              stopReason: event.message.stopReason,
              errorMessage: event.message.errorMessage,
            });
          }
          break;
      }
    });
    if (runOpts.onEvent) {
      agent.subscribe(async (event) => {
        try {
          await runOpts.onEvent(event);
        } catch (err) {
          logger.error('Harness: onEvent listener failed:', err.message);
        }
      });
    }

    notify(callbacks, 'onHarnessStart', {
      name,
      tools: tools.map((t) => t.name),
      config,
      traceId: telemetry.traceId,
      sessionId,
    });

    let errorMessage: string;
    try {
      telemetry.setRunContent({ input: { system: systemPrompt, prompts: promptMessages.map((m: any) => m.content) } });
      await agent.prompt(promptMessages);
    } finally {
      limits.dispose();
    }

    // ----- result
    const assistants = newMessages.filter((m): m is AssistantMessage => m.role === 'assistant');
    const final = assistants[assistants.length - 1];
    const outputToolCall = returnTypeSchema ? findOutputCall(newMessages) : undefined;
    const usage = totalUsage(newMessages);
    const stoppedBy = limits.stoppedBy;
    let stopReason: string = final?.stopReason || 'error';
    if (outputToolCall) stopReason = 'output';
    if (stoppedBy) stopReason = stoppedBy;
    else if (runOpts.signal?.aborted) stopReason = 'aborted';

    // a caller abort is a failure even if it landed between model calls
    const callerAborted = !stoppedBy && !!runOpts.signal?.aborted;
    const failed = callerAborted ||
      (final && (final.stopReason === 'error' || final.stopReason === 'aborted') && !stoppedBy);
    if (failed) {
      errorMessage = callerAborted ? 'aborted' : final.errorMessage || final.stopReason;
    }

    const metadata: HarnessRunMetadata & { totalCostUsd: number } = {
      traceId: telemetry.traceId,
      sessionId,
      turns,
      toolCalls,
      stopReason,
      stoppedBy,
      errorMessage,
      totalCostUsd: usage.cost,
    };

    telemetry.setRunContent({
      output: outputToolCall
        ? outputToolCall.arguments
        : (final?.content || []).filter((c) => c.type === 'text').map((c: any) => c.text).join('\n'),
    });
    await telemetry.finish({
      stopReason,
      errorMessage,
      attributes: { 'ps.turns': turns, 'ps.tool_call_count': toolCalls, 'ps.stopped_by': stoppedBy },
    });
    notify(callbacks, 'onHarnessEnd', { name, metadata, errors: errorMessage ? [{ message: errorMessage }] : undefined });

    if (failed) {
      const err: any = new Error(`Agent harness failed: ${errorMessage}`);
      err.harness = metadata;
      throw err;
    }

    return {
      response: toChatResponse({ final, outputToolCall, model: modelKey }),
      responseMetadata: {
        promptTokens: usage.input,
        completionTokens: usage.output,
        totalTokens: usage.totalTokens || usage.input + usage.output,
        harness: metadata,
        harnessMessages: newMessages,
      },
    };
  }

  function pricer(workspaceId?: number): PriceUsage | undefined {
    if (!pricingService) return undefined;
    return async (model, usage) => {
      const cost = await pricingService.computeCost({ model, usage, workspaceId });
      return cost?.cost_total ?? null;
    };
  }

  return { run };
}

export type HarnessServiceType = ReturnType<typeof HarnessService>;

/** Structured output: a terminating tool whose arguments are the function's return value. */
function outputTool(schema: object): HarnessTool {
  return {
    name: OUTPUT_TOOL_NAME,
    label: 'Output formatter',
    description: 'Output formatter. Call this with the final response to the user.',
    parameters: schema as Record<string, any>,
    execute: async () => ({ content: [{ type: 'text', text: 'Output recorded.' }], terminate: true }),
  };
}

function findOutputCall(messages: HarnessMessage[]): ToolCall | undefined {
  const failed = new Set(
    messages
      .filter((m) => m.role === 'toolResult' && m.toolName === OUTPUT_TOOL_NAME && m.isError)
      .map((m: any) => m.toolCallId)
  );
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== 'assistant') continue;
    const call = m.content.find((c): c is ToolCall => c.type === 'toolCall' && c.name === OUTPUT_TOOL_NAME && !failed.has(c.id));
    if (call) return call;
  }
  return undefined;
}

function notify(callbacks: Callback[], method: string, params: any) {
  for (const cb of callbacks) {
    try {
      (cb as any)[method]?.(params);
    } catch (err) {
      // callbacks must not break the run
    }
  }
}
