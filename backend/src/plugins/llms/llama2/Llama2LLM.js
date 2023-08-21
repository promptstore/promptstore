import { Configuration, OpenAIApi } from 'openai';

import { delay } from './utils';

function Llama2LLM({ __name, constants, logger }) {

  const configuration = new Configuration({
    apiKey: constants.OPENAI_API_KEY,
    basePath: constants.LLAMA2_BASE_PATH,
  });

  // The Llama2 API is OpenAI compatible
  const openai = new OpenAIApi(configuration);

  async function createChatCompletion(request, retryCount = 0) {
    let res;
    try {
      logger.debug('basePath:', constants.LLAMA2_BASE_PATH);
      res = await openai.createChatCompletion(request);
      return res.data;
    } catch (err) {
      logger.error(err, err.stack);
      if (res?.data.error?.message.startsWith('That model is currently overloaded with other requests')) {
        if (retryCount > 2) {
          throw new Error('Exceeded retry count: ' + String(err), { cause: err });
        }
        await delay(2000);
        return await createChatCompletion(request, retryCount + 1);
      }
    }
  }

  async function createCompletion(request) {
    const res = await openai.createCompletion(request);
    return res.data;
  }

  function createImage(prompt, n) {
    throw new Error('Not implemented');
  }

  function generateImageVariant(imageUrl, n) {
    throw new Error('Not implemented');
  }

  return {
    __name,
    createChatCompletion,
    createCompletion,
    createImage,
    generateImageVariant,
  };

}

export default Llama2LLM;
