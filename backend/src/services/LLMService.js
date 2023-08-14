export function LLMService({ logger, registry }) {

  async function createChatCompletion({ provider, messages, model, modelParams }) {
    const instance = registry[provider || 'openai'];
    return await instance.createChatCompletion(messages, model, modelParams);
  }

  async function createCompletion({ provider, prompt, model, modelParams }) {
    const instance = registry[provider || 'openai'];
    return await instance.createCompletion(prompt, model, modelParams);
  }

  async function fetchChatCompletion({ provider, messages, model, modelParams }) {
    const instance = registry[provider || 'openai'];
    return await instance.fetchChatCompletion(messages, model, modelParams);
  }

  async function fetchCompletion({ provider, input, model, modelParams }) {
    const instance = registry[provider || 'openai'];
    return await instance.fetchCompletion(input, model, modelParams);
  }

  async function createImage(provider, prompt, n) {
    const instance = registry[provider || 'openai'];
    return await instance.createImage(prompt, n);
  }

  async function generateImageVariant(imageUrl, n) {
    const instance = registry[provider || 'openai'];
    return await instance.generateImageVariant(imageUrl, n);
  }

  function getChatProviders() {
    return Object.entries(registry).map(([key, p]) => ({
      key,
      name: p.__name,
    }));
  }

  function getCompletionProviders() {
    return Object.entries(registry).map(([key, p]) => ({
      key,
      name: p.__name,
    }));
  }

  return {
    createChatCompletion,
    createCompletion,
    fetchChatCompletion,
    fetchCompletion,
    getChatProviders,
    getCompletionProviders,
    createImage,
    generateImageVariant,
  }

}
