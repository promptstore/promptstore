import { EventStream } from './EventStream';
import { emptyUsage } from './usage';
import { validateToolArguments } from './validation';
import type {
  AgentEvent,
  AgentEventSink,
  AgentLoopConfig,
  AssistantMessage,
  BeforeToolCallResult,
  HarnessContext,
  HarnessMessage,
  HarnessTool,
  LlmMessage,
  StreamFn,
  ToolCall,
  ToolResult,
  ToolResultMessage,
  TurnContext,
  TurnDecision,
  TurnUpdate,
} from './types';

/**
 * Start a run with new prompt messages. Returns an event stream whose
 * `result()` resolves to the messages added during the run.
 */
export function agentLoop(
  prompts: HarnessMessage[],
  context: HarnessContext,
  config: AgentLoopConfig,
  signal: AbortSignal | undefined,
  streamFn: StreamFn,
): EventStream<AgentEvent, HarnessMessage[]> {
  return toStream((emit) => runAgentLoop(prompts, context, config, emit, signal, streamFn));
}

/** Continue from the existing context (last message must not be an assistant message). */
export function agentLoopContinue(
  context: HarnessContext,
  config: AgentLoopConfig,
  signal: AbortSignal | undefined,
  streamFn: StreamFn,
): EventStream<AgentEvent, HarnessMessage[]> {
  return toStream((emit) => runAgentLoopContinue(context, config, emit, signal, streamFn));
}

function toStream(
  run: (emit: AgentEventSink) => Promise<HarnessMessage[]>,
): EventStream<AgentEvent, HarnessMessage[]> {
  const stream = new EventStream<AgentEvent, HarnessMessage[]>();
  run((e) => stream.push(e))
    .then((messages) => stream.end(messages))
    .catch((err) => stream.fail(err));
  return stream;
}

/**
 * Awaitable loop. `emit` is awaited, so subscribers act as barriers
 * (e.g. persistence completes before the next step).
 */
export async function runAgentLoop(
  prompts: HarnessMessage[],
  context: HarnessContext,
  config: AgentLoopConfig,
  emit: AgentEventSink,
  signal: AbortSignal | undefined,
  streamFn: StreamFn,
): Promise<HarnessMessage[]> {
  return runLoop(prompts, context, config, emit, signal, streamFn);
}

export async function runAgentLoopContinue(
  context: HarnessContext,
  config: AgentLoopConfig,
  emit: AgentEventSink,
  signal: AbortSignal | undefined,
  streamFn: StreamFn,
): Promise<HarnessMessage[]> {
  if (!context.messages.length) {
    throw new Error('Cannot continue: context has no messages');
  }
  if (context.messages[context.messages.length - 1].role === 'assistant') {
    throw new Error('Cannot continue: last message is an assistant message');
  }
  return runLoop([], context, config, emit, signal, streamFn);
}

export function defaultConvertToLlm(messages: HarnessMessage[]): LlmMessage[] {
  return messages.filter((m): m is LlmMessage =>
    m.role === 'user' || m.role === 'assistant' || m.role === 'toolResult'
  );
}

async function runLoop(
  prompts: HarnessMessage[],
  initialContext: HarnessContext,
  config: AgentLoopConfig,
  emit: AgentEventSink,
  signal: AbortSignal | undefined,
  streamFn: StreamFn,
): Promise<HarnessMessage[]> {
  let context: HarnessContext = { ...initialContext, messages: [...initialContext.messages] };
  const newMessages: HarnessMessage[] = [];
  let turn = 0;
  let lastTurn: TurnContext | undefined;

  const append = async (message: HarnessMessage) => {
    context.messages.push(message);
    newMessages.push(message);
    await emit({ type: 'message_start', message });
    await emit({ type: 'message_end', message });
  };

  const end = async () => {
    await emit({ type: 'agent_end', messages: newMessages });
    return newMessages;
  };

  await emit({ type: 'agent_start' });

  let pending: HarnessMessage[] = [...prompts];
  if (config.getSteeringMessages) {
    pending.push(...await config.getSteeringMessages());
  }
  let hasMoreToolCalls = false;
  let lastDecision: TurnDecision | undefined = undefined;

  // outer loop: re-entered when follow-up messages arrive
  while (true) {
    while (hasMoreToolCalls || pending.length || (turn === 0 && !prompts.length)) {
      if (lastTurn && config.prepareNextTurn) {
        const update = (await config.prepareNextTurn(lastTurn, signal)) as TurnUpdate | undefined;
        if (update?.context) {
          context = { ...update.context, messages: [...update.context.messages] };
          await emit({ type: 'context_replaced', messages: context.messages });
        }
        if (update?.messages?.length) {
          pending.push(...update.messages);
        }
      }

      turn += 1;
      await emit({ type: 'turn_start', turn });

      for (const message of pending) {
        await append(message);
      }
      pending = [];

      if (config.prepareRequest) {
        const replaced = await config.prepareRequest(context, signal);
        if (replaced) {
          context = { ...replaced, messages: [...replaced.messages] };
        }
      }

      const assistant = await streamAssistantResponse(context, config, emit, signal, streamFn);
      context.messages.push(assistant);
      newMessages.push(assistant);

      let toolResults: ToolResultMessage[] = [];
      let terminate = false;

      if (assistant.stopReason === 'error' || assistant.stopReason === 'aborted') {
        const turnCtx: TurnContext = { turn, message: assistant, toolResults, context, newMessages };
        await config.finishTurn?.(turnCtx, signal);
        await emit({ type: 'turn_end', turn, message: assistant, toolResults });
        return end();
      }

      const toolCalls = assistant.content.filter((c): c is ToolCall => c.type === 'toolCall');
      hasMoreToolCalls = toolCalls.length > 0;

      if (hasMoreToolCalls) {
        if (assistant.stopReason === 'length') {
          for (const call of toolCalls) {
            const result = errorResult(
              'The response hit the output token limit before this tool call was complete. ' +
              'Re-issue the tool call with a shorter response.'
            );
            await emit({ type: 'tool_execution_start', toolCallId: call.id, toolName: call.name, args: call.arguments });
            await emit({ type: 'tool_execution_end', toolCallId: call.id, toolName: call.name, args: call.arguments, result, isError: true, durationMs: 0 });
            toolResults.push(toToolResultMessage(call, result, true, 0));
          }
        } else {
          const outcome = await executeToolCalls(assistant, toolCalls, context, config, emit, signal);
          toolResults = outcome.results;
          terminate = outcome.terminate;
        }
        for (const result of toolResults) {
          await append(result);
        }
      }

      lastTurn = { turn, message: assistant, toolResults, context, newMessages };
      lastDecision = (await config.finishTurn?.(lastTurn, signal)) as TurnDecision | undefined;
      await emit({ type: 'turn_end', turn, message: assistant, toolResults });

      if (terminate || lastDecision?.action === 'end' || signal?.aborted) {
        return end();
      }

      if (config.getSteeringMessages) {
        pending.push(...await config.getSteeringMessages());
      }
    }

    const followUps = config.getFollowUpMessages ? await config.getFollowUpMessages() : [];
    if (followUps.length) {
      pending.push(...followUps);
      continue;
    }
    if (lastDecision?.action === 'continue') {
      // the hook asked for another turn on the current context
      lastDecision = undefined;
      hasMoreToolCalls = true;
      continue;
    }
    return end();
  }
}

async function streamAssistantResponse(
  context: HarnessContext,
  config: AgentLoopConfig,
  emit: AgentEventSink,
  signal: AbortSignal | undefined,
  streamFn: StreamFn,
): Promise<AssistantMessage> {
  const start = Date.now();
  let started = false;
  let final: AssistantMessage | undefined;
  try {
    let messages = context.messages;
    if (config.transformContext) {
      messages = await config.transformContext(messages, signal);
    }
    const convert = config.convertToLlm || defaultConvertToLlm;
    const llmMessages = await convert(messages);
    const stream = await streamFn(
      { systemPrompt: context.systemPrompt, messages: llmMessages, tools: context.tools },
      { ...config.streamOptions, signal },
    );
    for await (const event of stream) {
      switch (event.type) {
        case 'start':
          started = true;
          await emit({ type: 'message_start', message: event.partial });
          break;
        case 'text_delta':
        case 'thinking_delta':
        case 'toolcall_end':
          await emit({ type: 'message_update', message: event.partial, assistantMessageEvent: event });
          break;
        case 'done':
          final = event.message;
          break;
        case 'error':
          final = event.error;
          break;
      }
    }
    if (!final) {
      final = errorAssistant('Stream ended without a final message', signal);
    }
  } catch (err) {
    final = errorAssistant(err instanceof Error ? err.message : String(err), signal);
  }
  if (final.durationMs === undefined) {
    final.durationMs = Date.now() - start;
  }
  if (!started) {
    await emit({ type: 'message_start', message: final });
  }
  await emit({ type: 'message_end', message: final });
  return final;
}

interface PreparedCall {
  call: ToolCall;
  tool?: HarnessTool;
  args?: any;
  /** Set when the call fails preflight. */
  immediate?: { result: ToolResult; isError: boolean };
  terminate?: boolean;
}

async function executeToolCalls(
  assistant: AssistantMessage,
  toolCalls: ToolCall[],
  context: HarnessContext,
  config: AgentLoopConfig,
  emit: AgentEventSink,
  signal: AbortSignal | undefined,
): Promise<{ results: ToolResultMessage[]; terminate: boolean }> {
  const tools = context.tools || [];
  const sequential =
    config.toolExecution === 'sequential' ||
    toolCalls.some((c) => tools.find((t) => t.name === c.name)?.executionMode === 'sequential');

  const finalized = new Map<string, { result: ToolResult; isError: boolean; durationMs: number }>();

  const runOne = async (prepared: PreparedCall) => {
    const { call } = prepared;
    const t0 = Date.now();
    let result: ToolResult;
    let isError: boolean;
    if (prepared.immediate) {
      ({ result, isError } = prepared.immediate);
    } else if (signal?.aborted) {
      result = errorResult('Operation aborted');
      isError = true;
    } else {
      let settled = false;
      try {
        result = await prepared.tool!.execute(call.id, prepared.args, signal, (partial) => {
          if (settled) return;
          emit({ type: 'tool_execution_update', toolCallId: call.id, toolName: call.name, args: prepared.args, partialResult: partial });
        });
        isError = !!result.isError;
      } catch (err) {
        result = errorResult(err instanceof Error ? err.message : String(err));
        isError = true;
      }
      settled = true;
      if (prepared.terminate) {
        result = { ...result, terminate: true };
      }
      if (config.afterToolCall) {
        try {
          const override = await config.afterToolCall({
            assistantMessage: assistant, toolCall: call, args: prepared.args, result, isError, context,
          }, signal);
          if (override) {
            result = { ...result, ...override };
            if (override.isError !== undefined) isError = override.isError;
          }
        } catch (err) {
          result = errorResult(err instanceof Error ? err.message : String(err));
          isError = true;
        }
      }
    }
    const durationMs = Date.now() - t0;
    finalized.set(call.id, { result, isError, durationMs });
    await emit({
      type: 'tool_execution_end', toolCallId: call.id, toolName: call.name,
      args: prepared.args ?? call.arguments, result, isError, durationMs,
    });
  };

  // preflight runs in assistant order
  const prepared: PreparedCall[] = [];
  for (const call of toolCalls) {
    await emit({ type: 'tool_execution_start', toolCallId: call.id, toolName: call.name, args: call.arguments });
    const p = await prepareToolCall(assistant, call, tools, context, config, signal);
    prepared.push(p);
    if (sequential) {
      await runOne(p);
      if (signal?.aborted) break;
    }
  }

  if (!sequential) {
    await Promise.all(prepared.map(runOne));
  }

  const results: ToolResultMessage[] = [];
  for (const call of toolCalls) {
    const f = finalized.get(call.id) ?? { result: errorResult('Operation aborted'), isError: true, durationMs: 0 };
    results.push(toToolResultMessage(call, f.result, f.isError, f.durationMs));
  }
  const terminate = toolCalls.length > 0 && toolCalls.every((c) => finalized.get(c.id)?.result.terminate);
  return { results, terminate };
}

async function prepareToolCall(
  assistant: AssistantMessage,
  call: ToolCall,
  tools: HarnessTool[],
  context: HarnessContext,
  config: AgentLoopConfig,
  signal: AbortSignal | undefined,
): Promise<PreparedCall> {
  const tool = tools.find((t) => t.name === call.name);
  if (!tool) {
    return { call, immediate: { result: errorResult(`Tool ${call.name} not found`), isError: true } };
  }
  let args: any;
  try {
    const normalized = tool.prepareArguments ? { ...call, arguments: tool.prepareArguments(call.arguments) as any } : call;
    args = validateToolArguments(tool, normalized);
  } catch (err) {
    return { call, tool, immediate: { result: errorResult(err instanceof Error ? err.message : String(err)), isError: true } };
  }
  let terminate = false;
  if (config.beforeToolCall) {
    try {
      const decision = (await config.beforeToolCall({ assistantMessage: assistant, toolCall: call, args, context }, signal)) as BeforeToolCallResult | undefined;
      if (decision?.block) {
        const result = errorResult(decision.reason || 'Tool execution was blocked');
        if (decision.terminate) result.terminate = true;
        return { call, tool, args, immediate: { result, isError: true } };
      }
      terminate = !!decision?.terminate;
    } catch (err) {
      // fail safe: a throwing hook blocks the call
      return { call, tool, args, immediate: { result: errorResult(err instanceof Error ? err.message : String(err)), isError: true } };
    }
  }
  if (signal?.aborted) {
    return { call, tool, args, immediate: { result: errorResult('Operation aborted'), isError: true } };
  }
  return { call, tool, args, terminate };
}

function errorResult(text: string): ToolResult {
  return { content: [{ type: 'text', text }], details: {}, isError: true };
}

function toToolResultMessage(call: ToolCall, result: ToolResult, isError: boolean, durationMs: number): ToolResultMessage {
  return {
    role: 'toolResult',
    toolCallId: call.id,
    toolName: call.name,
    content: result.content,
    details: result.details,
    isError,
    timestamp: Date.now(),
    durationMs,
  };
}

export function errorAssistant(message: string, signal?: AbortSignal): AssistantMessage {
  return {
    role: 'assistant',
    content: [],
    usage: emptyUsage(),
    stopReason: signal?.aborted ? 'aborted' : 'error',
    errorMessage: message,
    timestamp: Date.now(),
  };
}
