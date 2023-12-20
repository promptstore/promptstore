import { ChromaClient } from 'chromadb'
import { flatten, unflatten } from 'flat';
import isEmpty from 'lodash.isempty';
import omit from 'lodash.omit';

function ChromaService({ __name, constants, logger }) {

  let _client;

  function getClient() {
    if (!_client) {
      _client = new ChromaClient({
        path: constants.CHROMA_SERVER
      });
    }
    return _client;
  }

  function getCollection(name) {
    return getClient().getCollection({ name });
  }

  function getIndexes() {
    try {
      return getClient().listCollections();
    } catch (err) {
      logger.error(err.message);
      return [];
    }
  }

  async function getIndex(indexName) {
    try {
      const collection = await getCollection(indexName);
      const numDocs = await collection.count();
      return {
        ...collection,
        numDocs,
      };
    } catch (err) {
      logger.error(err.message, err.stack);
      return null;
    }
  }

  async function createIndex(indexName, schema, params) {
    try {
      return await getClient().createCollection({
        name: indexName,
        metadata: params,
      });
    } catch (err) {
      logger.error(err.message);
      throw err;
    }
  }

  async function dropIndex(indexName) {
    try {
      await getClient().deleteCollection({ name: indexName });
    } catch (err) {
      logger.error(err.message);
      throw err;
    }
  }

  async function getNumberChunks(indexName) {
    try {
      const collection = await getCollection(indexName);
      if (collection) {
        return await collection.count();
      }
      logger.debug("collection '%s' not found", indexName);
      return 0;
    } catch (err) {
      logger.error(err.message, err.stack);
      throw err;
    }
  }

  async function dropData(indexName, { nodeLabel }) {
    try {
      const collection = await getCollection(indexName);
      if (collection) {
        logger.debug("dropping data from collection '%s'", collection.name);
        return await collection.delete({
          where: { nodeLabel },
        });
      }
      logger.debug("collection '%s' not found", indexName);
      return [];
    } catch (err) {
      logger.error(err.message, err.stack);
      return [];
    }
  }

  async function indexChunks(chunks, embeddings, { indexName }) {
    try {
      const ids = chunks.map(c => c.id);
      const documents = chunks.map(c => c.text);
      const metadatas = chunks.map(c => flatten(omit(c, ['id', 'text'])));
      const collection = await getCollection(indexName);
      logger.debug('documents length:', documents.length);
      logger.debug('embeddings length:', embeddings.length);
      return collection.upsert({
        documents,
        embeddings,
        ids,
        metadatas,
      });
    } catch (err) {
      logger.error(err.message, err.stack);
      throw err;
    }
  }

  function indexChunk(chunk, embeddings, params) {
    return indexChunks([chunk], embeddings, params);
  }

  async function deleteChunks(ids, { indexName }) {
    try {
      const collection = await getCollection(indexName);
      if (collection) {
        logger.debug("deleting chunks from collection '%s'", collection.name);
        return await collection.delete(ids);
      }
      logger.debug("collection '%s' not found", indexName);
      return [];
    } catch (err) {
      logger.error(err.message, err.stack);
      return [];
    }
  };

  async function deleteChunksMatching(query, attrs, { indexName }) {
    try {
      const collection = await getCollection(indexName);
      if (collection) {
        logger.debug("deleting chunks from collection '%s'", collection.name);
        let where;
        let whereDocument;
        if (query) {
          whereDocument = { $contains: { text: query } };
        }
        if (!isEmpty(attrs)) {
          where = attrs;
        }
        return await collection.delete(where, whereDocument);
      }
      logger.debug("collection '%s' not found", indexName);
      return [];
    } catch (err) {
      logger.error(err.message, err.stack);
      return [];
    }
  }

  async function deleteChunk(id, { indexName }) {
    try {
      const collection = await getCollection(indexName);
      if (collection) {
        logger.debug("deleting chunks from collection '%s'", collection.name);
        return await collection.delete([id]);
      }
      logger.debug("collection '%s' not found", indexName);
      return [];
    } catch (err) {
      logger.error(err.message, err.stack);
      return [];
    }
  };

  async function search(indexName, query, attrs, logicalType, params) {
    const { k, queryEmbedding } = params;
    try {
      const collection = await getCollection(indexName);
      if (collection) {
        let where;
        if (attrs) {
          const filters = Object.entries(attrs).map(([k, v]) => ({
            [k]: { '$eq': v }
          }));
          const op = '$' + logicalType;
          where = { [op]: filters };
        }
        let res;
        if (queryEmbedding) {
          res = await collection.query({
            queryEmbeddings: queryEmbedding,
            nResults: k,
            where,
          });
        } else {
          res = await collection.query({
            queryTexts: query,
            nResults: k,
            where,
          });
        }
        return res.ids[0]
          .map((id, i) => {
            const dist = res.distances[0][i];
            const metadata = res.metadatas[0][i];
            const nodeLabel = metadata.nodeLabel;
            delete metadata.nodeLabel;
            let doc = {
              id,
              text: res.documents[0][i],
              ...metadata,
            };
            doc = Object.entries(doc).reduce((a, [k, v]) => {
              a[nodeLabel + '__' + k] = v;
              return a;
            }, {});
            return {
              ...doc,
              dist,
            };
          })
          .map(d => Object.entries(d).reduce((a, [k, v]) => {
            const key = k.replace(/__/g, '.');
            a[key] = v;
            return a;
          }, {}))
          .map(unflatten);
      }
      logger.debug("collection '%s' not found", indexName);
      return [];
    } catch (err) {
      logger.error(err.message, err.stack);
      return [];
    }
  }

  return {
    __name,
    createIndex,
    deleteChunks,
    deleteChunksMatching,
    deleteChunk,
    dropData,
    dropIndex,
    getIndexes,
    getIndex,
    getNumberChunks,
    indexChunks,
    indexChunk,
    search,
  };
}

export default ChromaService;
