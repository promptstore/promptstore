export function SqlSourceService({ logger, registry }) {

  async function getSchema(source) {
    logger.debug(source, registry)
    const instance = registry[source.dialect];
    return await instance.getSchema(source);
  };

  async function getSample(source) {
    const instance = registry[source.dialect];
    return await instance.getSample(source);
  };

  return {
    getSample,
    getSchema,
  }

}
