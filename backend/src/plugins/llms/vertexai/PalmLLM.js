const { GoogleAuth } = require('google-auth-library');
const { TextServiceClient } = require('@google-ai/generativelanguage').v1beta2;

function PalmLLM({ __name, constants, logger }) {

  const client = new TextServiceClient({
    authClient: new GoogleAuth().fromAPIKey(constants.GOOGLE_API_KEY),
  });

  async function createChatCompletion(messages, model, maxTokens, n, retryCount = 0) {
    const res = await client.generateText({
      model: constants.PALM2_MODEL_NAME,
      prompt: {
        text: prompt,
      }
    });
    return res;
  }

  async function createCompletion(prompt, model, maxTokens, n) {
    const res = await client.generateText({
      model: constants.PALM2_MODEL_NAME,
      prompt: {
        text: prompt,
      }
    });
    return res;
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

module.exports = PalmLLM;