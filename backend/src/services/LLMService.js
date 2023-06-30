function LLMService({ logger, registry }) {

  async function createChatCompletion(provider, messages, model, maxTokens, n, hits) {
    const instance = registry[provider || 'openai'];
    return await instance.createChatCompletion(messages, model, maxTokens, n, hits);
  }

  async function createCompletion(provider, prompt, model, maxTokens, n) {
    const instance = registry[provider || 'openai'];
    return await instance.createCompletion(prompt, model, maxTokens, n);
  }

  async function fetchChatCompletion(provider, messages, model, maxTokens, n) {
    const instance = registry[provider || 'openai'];
    return await instance.fetchChatCompletion(messages, model, maxTokens, n);
  }

  async function fetchCompletion(provider, input, model, maxTokens, n) {
    const instance = registry[provider || 'openai'];
    return await instance.fetchCompletion(input, model, maxTokens, n);
  }

  return {
    createChatCompletion,
    createCompletion,
    fetchChatCompletion,
    fetchCompletion,
  }

}

module.exports = {
  LLMService,
}