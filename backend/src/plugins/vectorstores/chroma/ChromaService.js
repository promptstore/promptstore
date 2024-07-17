import { ChromaClient } from 'chromadb'
import { flatten, unflatten } from 'flat';
import isEmpty from 'lodash.isempty';
import omit from 'lodash.omit';

function ChromaService({ __name, constants, logger }) {

  let _client;

  function getClient() {
    if (!_client) {
      let auth;
      if (constants.ENV !== 'dev') {
        auth = {
          provider: 'token',
          credentials: constants.CHROMA_TOKEN,
          providerOptions: { headerType: 'AUTHORIZATION' },
        };
      }
      _client = new ChromaClient({
        path: constants.CHROMA_SERVER,
        auth,
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
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      logger.error(message);
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
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      logger.error(message);
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
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      logger.error(message);
      throw err;
    }
  }

  async function dropIndex(indexName) {
    try {
      await getClient().deleteCollection({ name: indexName });
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      logger.error(message);
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
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      logger.error(message);
      throw err;
    }
  }

  async function getChunks(indexName, ids) {
    try {
      const collection = await getCollection(indexName);
      if (collection) {
        const { documents, ids: _ids, metadatas } = await collection.get({ ids });
        const chunks = [];
        for (let i = 0; i < documents.length; i++) {
          const chunk = {
            ...metadatas[i],
            id: _ids[i],
            text: documents[i],
          };
          chunks.push(unflatten(chunk));
        }
        return chunks;
      }
      logger.debug("collection '%s' not found", indexName);
      return [];
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      logger.error(message);
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
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      logger.error(message);
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
      logger.debug('embeddings length:', embeddings?.length);
      return collection.upsert({
        documents,
        embeddings,
        ids,
        metadatas,
      });
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      logger.error(message);
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
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      logger.error(message);
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
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      logger.error(message);
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
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      logger.error(message);
      return [];
    }
  };

  async function search(indexName, query, attrs, logicalType, params) {
    const { k, queryEmbedding } = params;
    try {
      const collection = await getCollection(indexName);
      if (collection) {
        logger.debug('attrs:', attrs);
        let where;
        if (!isEmpty(attrs)) {
          const filters = Object.entries(attrs).map(([k, v]) => ({
            [k]: { '$eq': v }
          }));
          if (filters > 1) {
            const op = '$' + logicalType;
            where = { [op]: filters };
          } else {
            where = filters[0];
          }
        }
        let res;
        if (queryEmbedding) {
          res = await collection.query({
            queryEmbeddings: queryEmbedding,
            nResults: k,
            where,
          });
          logger.debug('res:', res);
          if (res.ids.length) {
            return res.ids[0]
              .map((id, i) => {
                const dist = res.distances[0][i];
                const metadata = res.metadatas[0][i];
                const nodeLabel = metadata.nodeLabel;
                delete metadata.nodeLabel;
                let doc = {
                  ...metadata,
                  id,
                  text: res.documents[0][i],
                  dist,
                };
                return Object.entries(doc).reduce((a, [k, v]) => {
                  a[nodeLabel + '__' + k] = v;
                  return a;
                }, {});
              })
              .map(d => Object.entries(d).reduce((a, [k, v]) => {
                const key = k.replace(/__/g, '.');
                a[key] = v;
                return a;
              }, {}))
              .map(unflatten);
          }
        } else {
          // still an embedding search and needs an embedding function
          // res = await collection.query({
          //   queryTexts: query,
          //   nResults: k,
          //   where,
          // });
          res = await collection.get({ where });
          logger.debug('res:', res);
          if (res.ids.length) {
            return res.ids
              .map((id, i) => {
                const dist = 0;
                const metadata = res.metadatas[i];
                const nodeLabel = metadata.nodeLabel;
                delete metadata.nodeLabel;
                let doc = {
                  ...metadata,
                  id,
                  text: res.documents[i],
                  dist,
                };
                return Object.entries(doc).reduce((a, [k, v]) => {
                  a[nodeLabel + '__' + k] = v;
                  return a;
                }, {});
              })
              .map(d => Object.entries(d).reduce((a, [k, v]) => {
                const key = k.replace(/__/g, '.');
                a[key] = v;
                return a;
              }, {}))
              .map(unflatten);
          }
        }
        return [];
      }
      logger.debug("collection '%s' not found", indexName);
      return [];
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      logger.error(message);
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
    getChunks,
    getIndexes,
    getIndex,
    getNumberChunks,
    indexChunks,
    indexChunk,
    search,
  };
}

export default ChromaService;
