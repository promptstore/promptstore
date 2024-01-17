import axios from 'axios';

function Gpt4AllLLM({ __name, constants, logger }) {

  async function createChatCompletion(messages, model, modelParams) {
    const prompt = messages.map((m) => m.content).join('\n\n');
    return createCompletion(prompt, model, maxTokens, n);
  }

  async function createCompletion(prompt, model, modelParams) {
    if (Array.isArray(prompt)) {
      prompt = prompt.join('\n\n');
    }
    const res = await axios.post(constants.GPT4ALL_API, { prompt });
    return res.data;
  }

  async function fetchChatCompletion(messages, model, modelParams) {
    const prompt = messages[messages.length - 1];  // user prompt
    const response = await createChatCompletion(messages, model, modelParams);
    return response.map((c) => ({ prompt, text: c.generation }));
  }

  async function fetchCompletion(input, model, modelParams) {
    const response = await createCompletion(input, model, modelParams);
    return response.map((c) => ({ prompt: input, text: c.generation }));
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
    fetchChatCompletion,
    fetchCompletion,
    createImage,
    generateImageVariant,
    getNumberTokens,
  };

}

export default Gpt4AllLLM;
