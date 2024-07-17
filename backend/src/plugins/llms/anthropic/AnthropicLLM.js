import Anthropic from '@anthropic-ai/sdk';

import { delay } from '../../../core/conversions';

import {
  fromAnthropicV1ChatResponse,
  toAnthropicV1ChatRequest,
} from './conversions';

function AnthropicLLM({ __name, constants, logger }) {

  const anthropic = new Anthropic({
    apiKey: constants.ANTHROPIC_API_KEY,
  });

  /**
   * 
   * @param {*} request 
   * @param {*} parserService
   * @param {*} retryCount 
   * @returns 
   */
  async function createChatCompletion(request, parserService, retryCount = 0) {
    let res;
    try {
      const req = await toAnthropicV1ChatRequest(request);
      logger.debug('req:', req);
      res = await anthropic.messages.create(req);
      // logger.debug('res:', res);
      return fromAnthropicV1ChatResponse(res, parserService);
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
        return createChatCompletion(request, retryCount + 1);
      }
    }
  }

  /**
   * 
   * @param {*} request 
   * @param {*} parserService
   * @param {*} retryCount 
   * @returns 
   */
  function createCompletion(request, parserService, retryCount = 0) {
    return createChatCompletion(request, parserService, retryCount);
  }

  function getNumberTokens(model, text) {
    throw new Error('Not implemented');
  }

  return {
    __name,
    createChatCompletion,
    createCompletion,
    getNumberTokens,
  };

}

export default AnthropicLLM;
