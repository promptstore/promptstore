function ParserService({ registry, logger }) {

  async function parse(provider, text) {
    const instance = registry[provider];
    return await instance.parse(text);
  }

  function getOutputParsers() {
    return Object.entries(registry)
      .map(([key, p]) => ({
        key,
        name: p.__name,
      }));
  }

  return {
    getOutputParsers,
    parse,
  };

}

module.exports = {
  ParserService,
}