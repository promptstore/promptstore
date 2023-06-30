const { GoogleAuth } = require('google-auth-library');
const { TextServiceClient } = require('@google-ai/generativelanguage').v1beta2;

const MODEL_NAME = 'models/text-bison-001';

function PalmLLM({ constants, logger }) {

  const client = new TextServiceClient({
    authClient: new GoogleAuth().fromAPIKey(constants.GOOGLE_API_KEY),
  });

  async function createChatCompletion(messages, model, maxTokens, n, hits, retryCount = 0) {
    const res = await client.generateText({
      model: MODEL_NAME,
      prompt: {
        text: prompt,
      }
    });
    return res;
  }

  async function createCompletion(prompt, model, maxTokens, n) {
    const res = await client.generateText({
      model: MODEL_NAME,
      prompt: {
        text: prompt,
      }
    });
    return res;
  }

  const fetchChatCompletion = async (messages, model, maxTokens, n) => {
    const prompt = messages[messages.length - 1];
    const response = await createChatCompletion(messages, model, maxTokens, n);
    logger.debug('response:', response);
    return {
      ...response,
      choices: response.choices.map((c) => ({ ...c, prompt })),
    };
  };

  const fetchCompletion = async (input, model, maxTokens, n) => {
    const response = await createCompletion(prompt, model, maxTokens, n);
    logger.debug('response:', response);
    return {
      ...response,
      choices: response.choices.map((c) => ({ ...c, prompt: input })),
    };
  };

  return {
    createChatCompletion,
    createCompletion,
    fetchChatCompletion,
    fetchCompletion,
  };

}

module.exports = PalmLLM;
