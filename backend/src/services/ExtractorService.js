function ExtractorService({ registry, logger }) {

  async function extract(provider, file) {
    const instance = registry[provider];
    return await instance.extract(file);
  }

  function getExtractors() {
    return Object.entries(registry)
      .map(([key, p]) => ({
        key,
        name: p.__name,
      }));
  }

  return {
    getExtractors,
    extract,
  };

}

module.exports = {
  ExtractorService,
}