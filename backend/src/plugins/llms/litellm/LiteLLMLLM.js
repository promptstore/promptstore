import OpenAI from 'openai';

import { delay } from '../../../core/conversions';

// LiteLLM exposes an OpenAI-compatible chat-completions interface, so we reuse the
// OpenAI provider's request/response conversions as the single source of truth.
import {
  fromOpenAIChatResponse,
  fromOpenAICompletionResponse,
  toOpenAIChatRequest,
  toOpenAICompletionRequest,
} from '../openai/conversions';

/**
 * LiteLLM provider plugin.
 *
 * Routes chat/completion/embedding requests through a LiteLLM proxy
 * (https://docs.litellm.ai/docs/simple_proxy) which presents the OpenAI
 * chat-completions API. Configure via:
 *   - LITELLM_BASE_URL: the proxy base URL, e.g. http://localhost:4000
 *   - LITELLM_API_KEY:  the proxy master/virtual key
 */
function LiteLLMLLM({ __name, constants, logger }) {

  const openai = new OpenAI({
    apiKey: constants.LITELLM_API_KEY,
    baseURL: constants.LITELLM_BASE_URL,
  });

  async function createChatCompletion(request, parserService, retryCount = 0) {
    let res;
    try {
      const req = toOpenAIChatRequest(request);
      if (request.stream) {
        res = await openai.chat.completions.create(req, { responseType: 'stream' });
      } else {
        res = await openai.chat.completions.create(req);
      }
      const response = await fromOpenAIChatResponse(res, parserService);
      logger.debug('response:', response);
      return {
        ...response,
        model: request.model,
      };
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      logger.error(message);
      if (res?.error?.message.startsWith('That model is currently overloaded with other requests')) {
        if (retryCount > 2) {
          throw new Error('Exceeded retry count: ' + err.message, { cause: err });
        }
        await delay(2000);
        return createChatCompletion(request, parserService, retryCount + 1);
      }
      throw err;
    }
  }

  async function createCompletion(request, parserService, retryCount = 0) {
    let res;
    try {
      const req = toOpenAICompletionRequest(request);
      res = await openai.completions.create(req);
      const response = await fromOpenAICompletionResponse(res, parserService);
      return {
        ...response,
        model: request.model,
      };
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      logger.error(message);
      if (res?.error?.message.startsWith('That model is currently overloaded with other requests')) {
        if (retryCount > 2) {
          throw new Error('Exceeded retry count: ' + err.message, { cause: err });
        }
        await delay(2000);
        return createCompletion(request, parserService, retryCount + 1);
      }
      throw err;
    }
  }

  function createEmbedding(request) {
    logger.debug('embedding request:', request);
    return openai.embeddings.create(request);
  }

  function getNumberTokens(model, text) {
    throw new Error('Not implemented');
  }

  return {
    __name,
    createChatCompletion,
    createCompletion,
    createEmbedding,
    getNumberTokens,
  };

}

export default LiteLLMLLM;
