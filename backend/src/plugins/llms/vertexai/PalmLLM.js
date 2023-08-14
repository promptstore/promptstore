import { GoogleAuth } from 'google-auth-library';
import genlang from '@google-ai/generativelanguage';

const { TextServiceClient } = genlang.v1beta2;

function PalmLLM({ __name, constants, logger }) {

  const client = new TextServiceClient({
    authClient: new GoogleAuth().fromAPIKey(constants.GOOGLE_API_KEY),
  });

  async function createChatCompletion(messages, model, modelParams, retryCount = 0) {
    const res = await client.generateText({
      model: constants.PALM2_MODEL_NAME,
      prompt: {
        text: prompt,
      }
    });
    return res;
  }

  async function createCompletion(prompt, model, modelParams) {
    const res = await client.generateText({
      model: constants.PALM2_MODEL_NAME,
      prompt: {
        text: prompt,
      }
    });
    return res;
  }

  const fetchChatCompletion = async (messages, model, modelParams) => {
    const prompt = messages[messages.length - 1];
    const response = await createChatCompletion(messages, model, modelParams);
    return {
      ...response,
      choices: response.choices.map((c) => ({ ...c, prompt })),
    };
  };

  const fetchCompletion = async (input, model, modelParams) => {
    const response = await createCompletion(prompt, model, modelParams);
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

export default PalmLLM;
