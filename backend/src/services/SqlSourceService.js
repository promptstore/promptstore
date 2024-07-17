export function SqlSourceService({ logger, registry }) {

  function createTable(destination, data, schema, connectionString) {
    const instance = registry[destination.dialect];
    return instance.createTable(destination, data, schema, connectionString);
  };

  function getCategoricalValues(source) {
    const instance = registry[source.dialect];
    return instance.getCategoricalValues(source);
  };

  function getData(source, limit, columns) {
    const instance = registry[source.dialect];
    return instance.getData(source, limit, columns);
  };

  function getDataColumns(source, limit, columns) {
    const instance = registry[source.dialect];
    return instance.getDataColumns(source, limit, columns);
  };

  function getDDL(source) {
    const instance = registry[source.dialect];
    return instance.getDDL(source);
  };

  function getSample(source) {
    const instance = registry[source.dialect];
    return instance.getSample(source);
  };

  function getSchema(source) {
    const instance = registry[source.dialect];
    return instance.getSchema(source);
  };

  function getDialects() {
    return Object.entries(registry).map(([key, p]) => ({
      key,
      name: p.__name,
    }));
  }

  return {
    createTable,
    getCategoricalValues,
    getData,
    getDataColumns,
    getDDL,
    getDialects,
    getSample,
    getSchema,
  }

}
