function GuardrailsService({ registry, logger }) {

  async function scan(provider, text) {
    const instance = registry[provider];
    return await instance.scan(text);
  }

  function getGuardrails(type) {
    return Object.entries(registry)
      .filter(([key, p]) => !type || p.__metadata.type === type)
      .map(([key, p]) => ({
        key,
        name: p.__name,
        type: p.__metadata.type,
      }));
  }

  return {
    getGuardrails,
    scan,
  };

}

module.exports = {
  GuardrailsService,
}