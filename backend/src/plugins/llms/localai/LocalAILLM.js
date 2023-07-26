const { Configuration, OpenAIApi } = require('openai');

const { delay } = require('./utils');

function LocalAILLM({ __name, constants, logger }) {

  const configuration = new Configuration({
    apiKey: constants.OPENAI_API_KEY,
    basePath: constants.LOCALAI_BASE_PATH,
  });

  // The LocalAI API is OpenAI compatible
  const openai = new OpenAIApi(configuration);

  async function createChatCompletion(messages, model, maxTokens, n, retryCount = 0) {
    let resp;
    try {
      const opts = {
        max_tokens: maxTokens,
        messages,
        model,
        n,
      };
      resp = await openai.createChatCompletion(opts);
      return resp.data;
    } catch (err) {
      logger.error(String(err));
      if (resp?.data.error?.message.startsWith('That model is currently overloaded with other requests')) {
        if (retryCount > 2) {
          throw new Error('Exceeded retry count: ' + String(err), { cause: err });
        }
        await delay(2000);
        return await createChatCompletion(messages, maxTokens, n, retryCount + 1);
      }
    }
  }

  async function createCompletion(prompt, model, maxTokens, n) {
    const resp = await openai.createCompletion({
      max_tokens: maxTokens,
      model,
      n,
      prompt,
    });
    return resp.data.choices;
  }

  const fetchChatCompletion = async (messages, model, maxTokens, n) => {
    const prompt = messages[messages.length - 1];
    const response = await createChatCompletion(messages, model, maxTokens, n);
    return {
      ...response,
      choices: response.choices.map((c) => ({ ...c, prompt })),
    };
  };

  const fetchCompletion = async (input, model, maxTokens, n) => {
    const response = await createCompletion(prompt, model, maxTokens, n);
    return {
      ...response,
      choices: response.choices.map((c) => ({ ...c, prompt: input })),
    };
  };

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
    fetchChatCompletion,
    fetchCompletion,
    createImage,
    generateImageVariant,
  };

}

module.exports = LocalAILLM;
