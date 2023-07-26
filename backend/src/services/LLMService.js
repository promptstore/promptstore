function LLMService({ logger, registry }) {

  async function createChatCompletion(provider, messages, model, maxTokens, n, functions, stop) {
    const instance = registry[provider || 'openai'];
    return await instance.createChatCompletion(messages, model, maxTokens, n, functions, stop);
  }

  async function createCompletion(provider, prompt, model, maxTokens, n, stop) {
    const instance = registry[provider || 'openai'];
    return await instance.createCompletion(prompt, model, maxTokens, n, stop);
  }

  async function fetchChatCompletion(provider, messages, model, maxTokens, n, functions, stop) {
    const instance = registry[provider || 'openai'];
    return await instance.fetchChatCompletion(messages, model, maxTokens, n, functions, stop);
  }

  async function fetchCompletion(provider, input, model, maxTokens, n) {
    const instance = registry[provider || 'openai'];
    return await instance.fetchCompletion(input, model, maxTokens, n);
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

module.exports = {
  LLMService,
}