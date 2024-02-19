import OpenAI from 'openai';

import { delay } from './utils';

function LlamaApi({ __name, constants, logger }) {

  // The Llama API is OpenAI compatible
  const openai = new OpenAI({
    apiKey: constants.LLAMAAPI_API_KEY,
    baseURL: constants.LLAMAAPI_BASE_PATH,
  });

  async function createChatCompletion(request, retryCount = 0) {
    let res;
    try {
      res = await openai.chat.completions.create(request);
      return res;
    } catch (err) {
      logger.error(err, err.stack);
      if (res?.error?.message.startsWith('That model is currently overloaded with other requests')) {
        if (retryCount > 2) {
          throw new Error('Exceeded retry count: ' + String(err), { cause: err });
        }
        await delay(2000);
        return await createChatCompletion(request, retryCount + 1);
      }
    }
  }

  async function createCompletion(request) {
    const res = await openai.chat.completions.create(request);
    return res;
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

export default LlamaApi;
