import { emptyUsage } from '../usage';
import type { AssistantMessage, AssistantMessageEvent, LlmContext, StreamFn, ToolCall } from '../types';

export type ScriptedTurn =
  | { text?: string; toolCalls?: Omit<ToolCall, 'type'>[]; cost?: number; stopReason?: 'stop' | 'length' }
  | { error: string }
  | { throws: string };

export function assistant(turn: { text?: string; toolCalls?: Omit<ToolCall, 'type'>[]; cost?: number; stopReason?: 'stop' | 'length' }): AssistantMessage {
  const content: AssistantMessage['content'] = [];
  if (turn.text) content.push({ type: 'text', text: turn.text });
  for (const c of turn.toolCalls || []) content.push({ type: 'toolCall', ...c });
  return {
    role: 'assistant',
    content,
    usage: { ...emptyUsage(), input: 10, output: 5, totalTokens: 15, cost: turn.cost ?? 0 },
    stopReason: turn.stopReason ?? (turn.toolCalls?.length ? 'toolUse' : 'stop'),
    timestamp: Date.now(),
  };
}

/** A StreamFn that replays scripted turns and records the contexts it saw. */
export function scriptedStream(turns: ScriptedTurn[]) {
  const contexts: LlmContext[] = [];
  let i = 0;
  const streamFn: StreamFn = async function* (context: LlmContext, options): AsyncGenerator<AssistantMessageEvent> {
    contexts.push(structuredClone({ ...context, tools: undefined }));
    const turn = turns[i++] ?? { text: 'done' };
    if ('throws' in turn) throw new Error(turn.throws);
    if (options?.signal?.aborted) {
      const msg = { ...assistant({}), stopReason: 'aborted' as const, errorMessage: 'aborted' };
      yield { type: 'error', reason: 'aborted', error: msg };
      return;
    }
    if ('error' in turn) {
      const msg = { ...assistant({}), stopReason: 'error' as const, errorMessage: turn.error };
      yield { type: 'error', reason: 'error', error: msg };
      return;
    }
    const message = assistant(turn);
    yield { type: 'start', partial: message };
    yield { type: 'done', reason: message.stopReason as any, message };
  };
  return { streamFn, contexts, calls: () => i };
}
