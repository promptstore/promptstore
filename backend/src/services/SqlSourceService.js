export function SqlSourceService({ logger, registry }) {

  async function createTable(destination, data) {
    const instance = registry[destination.dialect];
    return await instance.createTable(destination, data);
  };

  async function getData(source, limit) {
    const instance = registry[source.dialect];
    return await instance.getData(source, limit);
  };

  async function getDDL(source) {
    const instance = registry[source.dialect];
    return await instance.getDDL(source);
  };

  async function getSample(source) {
    const instance = registry[source.dialect];
    return await instance.getSample(source);
  };

  async function getSchema(source) {
    const instance = registry[source.dialect];
    return await instance.getSchema(source);
  };

  function getDialects() {
    return Object.entries(registry).map(([key, p]) => ({
      key,
      name: p.__name,
    }));
  }

  return {
    createTable,
    getData,
    getDDL,
    getDialects,
    getSample,
    getSchema,
  }

}
