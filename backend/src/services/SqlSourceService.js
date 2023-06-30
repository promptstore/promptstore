function SqlSourceService({ logger, registry }) {

  async function getSchema(source) {
    const instance = registry[source.dialect];
    return await instance.getSchema(source);
  };

  async function getSample(source, tableName, limit) {
    const instance = registry[source.dialect];
    return await instance.getSample(source, tableName, limit);
  };

  return {
    getSample,
    getSchema,
  }

}

module.exports = {
  SqlSourceService,
}