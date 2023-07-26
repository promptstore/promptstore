const axios = require('axios');

function Gpt4AllLLM({ __name, constants, logger }) {

  async function createChatCompletion(messages, model, maxTokens, n) {
    const prompt = messages.map((m) => m.content).join('\n\n');
    return createCompletion(prompt, model, maxTokens, n);
  }

  async function createCompletion(prompt, model, maxTokens, n) {
    if (Array.isArray(prompt)) {
      prompt = prompt.join('\n\n');
    }
    const res = await axios.post(constants.GPT4ALL_API, { prompt });
    return res.data;
  }

  async function fetchChatCompletion(messages, model, maxTokens, n) {
    const prompt = messages[messages.length - 1];  // user prompt
    const response = await createChatCompletion(messages, model, maxTokens, n);
    return response.map((c) => ({ prompt, text: c.generation }));
  }

  async function fetchCompletion(input, model, maxTokens, n) {
    const response = await createCompletion(input, model, maxTokens, n);
    return response.map((c) => ({ prompt: input, text: c.generation }));
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
    fetchChatCompletion,
    fetchCompletion,
    createImage,
    generateImageVariant,
  };

}

module.exports = Gpt4AllLLM;
