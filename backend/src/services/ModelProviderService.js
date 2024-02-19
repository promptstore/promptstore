export function ModelProviderService({ logger, registry }) {

  async function getModels(provider, q) {
    const instance = registry[provider];
    return await instance.getModels(q);
  }

  async function query(provider, model, args) {
    const instance = registry[provider];
    return await instance.getModels(model, args);
  }

  function getProviders() {
    return Object.entries(registry)
      .map(([key, p]) => ({
        key,
        name: p.__name,
      }));
  }

  return {
    getModels,
    getProviders,
    query,
  }
}
