import OpenAI from 'openai';

import { delay } from '../../../core/conversions';

function LocalAILLM({ __name, constants, logger }) {

  // The LocalAI API is OpenAI compatible
  const openai = new OpenAI({
    apiKey: constants.OPENAI_API_KEY,
    basePath: constants.LOCALAI_BASE_PATH,
  });

  async function createChatCompletion(request, retryCount = 0) {
    let res;
    try {
      res = await openai.chat.completions.create(request);
      return res;
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

  async function createCompletion(request, retryCount = 0) {
    let res;
    try {
      res = await openai.completions.create(request);
      return res;
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
        return createCompletion(request, retryCount + 1);
      }
    }
  }

  function createImage(prompt, options) {
    throw new Error('Not implemented');
  }

  function generateImageVariant(imageUrl, options) {
    throw new Error('Not implemented');
  }

  function getNumberTokens(model, text) {
    throw new Error('Not implemented');
  }

  return {
    __name,
    createChatCompletion,
    createCompletion,
    createImage,
    generateImageVariant,
    getNumberTokens,
  };

}

export default LocalAILLM;
