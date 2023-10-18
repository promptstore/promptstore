export function GraphStoreService({ logger, registry }) {

  async function getDocuments(graphstore, params) {
    logger.debug('graphstore:', graphstore);
    const instance = registry[graphstore];
    return instance.getDocuments(params);
  };

  async function getSchema(graphstore, params) {
    logger.debug('graphstore:', graphstore);
    const instance = registry[graphstore];
    return instance.getSchema(params);
  };

  function getGraphStores() {
    return Object.entries(registry)
      .map(([key, p]) => ({
        key,
        name: p.__name,
      }));
  }

  return {
    getDocuments,
    getGraphStores,
    getSchema,
  }

}
