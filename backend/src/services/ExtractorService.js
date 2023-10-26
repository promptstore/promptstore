export function ExtractorService({ registry, logger }) {

  async function extract(provider, filepath, originalname, mimetype) {
    const instance = registry[provider];
    return await instance.extract(filepath, originalname, mimetype);
  }

  async function getDefaultOptions(provider) {
    const instance = registry[provider];
    return instance.defaultOptions || {};
  };

  async function getSchema(provider, params) {
    const instance = registry[provider];
    return instance.getSchema(params);
  };

  async function getChunks(provider, documents, params) {
    const instance = registry[provider];
    return instance.getChunks(documents, params);
  };

  function getExtractors() {
    return Object.entries(registry)
      .map(([key, p]) => ({
        key,
        name: p.__name,
      }));
  }

  return {
    extract,
    getChunks,
    getDefaultOptions,
    getExtractors,
    getSchema,
  };

}
