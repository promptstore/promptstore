export function EmbeddingService({ logger, registry }) {

  async function createEmbedding(provider, content) {
    const instance = registry[provider];
    return instance.createEmbedding(content);
  };

  return {
    createEmbedding,
  }

}
