function ModelProviderService({ logger, registry }) {

  async function getModels(provider, q) {
    const instance = registry[provider];
    return await instance.getModels(q);
  }

  async function query(provider, model, args) {
    const instance = registry[provider];
    return await instance.getModels(model, args);
  }

  return {
    getModels,
    query,
  }
}

module.exports = {
  ModelProviderService,
}