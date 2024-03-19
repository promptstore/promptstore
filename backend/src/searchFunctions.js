export default ({ constants, logger, services }) => {

  const {
    SEARCH_EMBEDDING_MODEL,
    SEARCH_EMBEDDING_PROVIDER,
    SEARCH_INDEX_NAME,
    SEARCH_NODE_LABEL,
    SEARCH_VECTORSTORE_PROVIDER,
  } = constants;

  const { llmService, vectorStoreService } = services;

  async function deleteObjects(ids) {
    try {
      await vectorStoreService.deleteChunks(SEARCH_VECTORSTORE_PROVIDER, ids, {
        indexName: SEARCH_INDEX_NAME,
      });
    } catch (err) {
      logger.error('Error deleting objects [ids=%s]:', ids, err);
    }
  }

  async function deleteObject(id) {
    try {
      await vectorStoreService.deleteChunk(SEARCH_VECTORSTORE_PROVIDER, id, {
        indexName: SEARCH_INDEX_NAME,
      });
    } catch (err) {
      logger.error('Error deleting object [id=%s]:', id, err);
    }
  }

  async function indexObject(obj, chunkId) {
    try {
      let embeddings;
      if (SEARCH_VECTORSTORE_PROVIDER !== 'redis' && SEARCH_VECTORSTORE_PROVIDER !== 'elasticsearch') {
        const response = await llmService.createEmbedding(SEARCH_EMBEDDING_PROVIDER, {
          input: obj.text,
          model: SEARCH_EMBEDDING_MODEL,
        });
        embeddings = [response.data[0].embedding];
      }
      let ids;
      if (chunkId) {
        ids = [chunkId];
      }
      const chunkIds = await vectorStoreService.indexChunks(SEARCH_VECTORSTORE_PROVIDER, [obj], embeddings, {
        indexName: SEARCH_INDEX_NAME,
        nodeLabel: SEARCH_NODE_LABEL,
        chunkIds: ids,
      });
      return chunkIds?.[0];
    } catch (err) {
      logger.error('Error indexing object [label=%s; name=%s; id=%s]:', obj.label, obj.name, obj.id, err);
    }
  }

  return {
    deleteObjects,
    deleteObject,
    indexObject,
  }

}