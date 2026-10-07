import { Callback } from '../callbacks/Callback';
import { ChatRequest, ModelParams } from '../conversions/RosettaStone';
import { LLMModel } from '../models/llm_types';
import type { AssistantMessageEvent, LlmContext, StreamFn, Usage } from '../../lib/harness';
import { emptyUsage, errorAssistant } from '../../lib/harness';
import { fromChatResponse, toRosettaMessages, toRosettaTools } from './conversions';

/** Providers whose plugins support native `tools` / `tool_calls`. */
const NATIVE_TOOL_PROVIDERS = new Set(['openai', 'anthropic']);

export type PriceUsage = (model: string, usage: { prompt_tokens: number; completion_tokens: number }) => Promise<number | null>;

export interface ModelStreamFnParams {
  model: LLMModel;
  provider: string;
  modelKey: string;
  modelParams: Partial<ModelParams>;
  callbacks?: Callback[];
  priceUsage?: PriceUsage;
}

/**
 * A harness StreamFn backed by promptstore's model layer (`LLMChatModel.call`),
 * so model callbacks and provider plugins apply to every turn.
 *
 * Provider streaming is not implemented in the plugins, so each turn emits
 * `start` then `done`. The semantic cache is bypassed: a cache keyed on the
 * last message is not safe mid tool loop.
 */
export function createModelStreamFn({
  model,
  provider,
  modelKey,
  modelParams,
  callbacks,
  priceUsage,
}: ModelStreamFnParams): StreamFn {
  const native = NATIVE_TOOL_PROVIDERS.has(provider);

  return async function* (context: LlmContext, options): AsyncGenerator<AssistantMessageEvent> {
    const signal = options?.signal;
    const start = Date.now();
    try {
      if (signal?.aborted) {
        const error = errorAssistant('Operation aborted', signal);
        yield { type: 'error', reason: 'aborted', error };
        return;
      }
      const tools = context.tools?.length ? toRosettaTools(context.tools) : undefined;
      const request: ChatRequest = {
        model: modelKey,
        model_params: { ...modelParams },
        prompt: {
          context: context.systemPrompt ? { system_prompt: context.systemPrompt } : undefined,
          messages: toRosettaMessages(context.messages, !native),
        },
      };
      if (tools && native) {
        request.tools = tools as any;
        request.tool_choice = 'auto';
      } else if (tools) {
        request.functions = tools.map((t) => t.function) as any;
      }
      const { response, responseMetadata } = await abortable(
        model.call({ provider, request, callbacks, skipCache: true }),
        signal,
      );
      const usage: Usage = {
        ...emptyUsage(),
        input: responseMetadata?.promptTokens || 0,
        output: responseMetadata?.completionTokens || 0,
        totalTokens: responseMetadata?.totalTokens
          || (responseMetadata?.promptTokens || 0) + (responseMetadata?.completionTokens || 0),
      };
      if (priceUsage) {
        try {
          usage.cost = (await priceUsage(response.model || modelKey, {
            prompt_tokens: usage.input,
            completion_tokens: usage.output,
          })) || 0;
        } catch (err) {
          // pricing is best-effort
        }
      }
      const message = fromChatResponse(response, usage, provider);
      message.durationMs = Date.now() - start;
      yield { type: 'start', partial: message };
      yield { type: 'done', reason: message.stopReason as 'stop' | 'length' | 'toolUse', message };
    } catch (err) {
      const error = errorAssistant(err instanceof Error ? err.message : String(err), signal);
      error.provider = provider;
      error.model = modelKey;
      error.durationMs = Date.now() - start;
      yield { type: 'error', reason: error.stopReason as 'error' | 'aborted', error };
    }
  };
}

/** Reject as soon as the signal aborts (the provider call itself may not be cancellable). */
function abortable<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new Error('Operation aborted'));
    if (signal.aborted) return onAbort();
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (v) => { signal.removeEventListener('abort', onAbort); resolve(v); },
      (e) => { signal.removeEventListener('abort', onAbort); reject(e); },
    );
  });
}
