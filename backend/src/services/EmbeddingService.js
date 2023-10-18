export function EmbeddingService({ logger, registry }) {

  async function createEmbedding(provider, content) {
    const instance = registry[provider];
    return instance.createEmbedding(content);
  };

  function getEmbeddingProviders() {
    return Object.entries(registry)
      .map(([key, p]) => ({
        key,
        name: p.__name,
      }));
  }

  return {
    createEmbedding,
    getEmbeddingProviders,
  }

}
