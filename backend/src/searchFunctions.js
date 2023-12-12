export default ({ constants, services }) => {

  const { SEARCH_INDEX_NAME, SEARCH_NODE_LABEL, SEARCH_VECTORSTORE_PROVIDER } = constants;
  const { vectorStoreService } = services;

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

  async function indexObject(obj) {
    try {
      await vectorStoreService.indexChunks(SEARCH_VECTORSTORE_PROVIDER, [obj], null, {
        indexName: SEARCH_INDEX_NAME,
        nodeLabel: SEARCH_NODE_LABEL,
      });
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