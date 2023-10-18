export function VectorStoreService({ logger, registry }) {

  async function getIndexes(vectorstore) {
    logger.debug('vectorstore:', vectorstore);
    const instance = registry[vectorstore];
    return instance.getIndexes();
  };

  async function getIndex(vectorstore, indexName, params) {
    logger.debug('vectorstore:', vectorstore);
    const instance = registry[vectorstore];
    return instance.getIndex(indexName, params);
  };

  async function createIndex(vectorstore, indexName, params) {
    logger.debug('vectorstore:', vectorstore);
    const instance = registry[vectorstore];
    return instance.createIndex(indexName, params);
  };

  async function dropIndex(vectorstore, indexName) {
    logger.debug('vectorstore:', vectorstore);
    const instance = registry[vectorstore];
    return instance.dropIndex(indexName);
  };

  async function dropData(vectorstore, params) {
    logger.debug('vectorstore:', vectorstore);
    const instance = registry[vectorstore];
    return instance.dropData(params);
  };

  async function addDocuments(vectorstore, docs, embeddings, params) {
    logger.debug('vectorstore:', vectorstore);
    const instance = registry[vectorstore];
    return instance.addDocuments(docs, embeddings, params);
  };

  async function deleteDocument(vectorstore, id) {
    logger.debug('vectorstore:', vectorstore);
    const instance = registry[vectorstore];
    return instance.deleteDocument(id);
  };

  async function deleteDocuments(vectorstore, ids) {
    logger.debug('vectorstore:', vectorstore);
    const instance = registry[vectorstore];
    return instance.deleteDocuments(ids);
  };

  async function search(vectorstore, indexName, query, attrs, params) {
    logger.debug('vectorstore:', vectorstore);
    const instance = registry[vectorstore];
    return instance.search(indexName, query, attrs, params);
  };

  function getVectorStores() {
    return Object.entries(registry)
      .map(([key, p]) => ({
        key,
        name: p.__name,
      }));
  }

  return {
    getIndexes,
    getIndex,
    createIndex,
    dropIndex,
    dropData,
    addDocuments,
    deleteDocument,
    deleteDocuments,
    getVectorStores,
    search,
  };

}
