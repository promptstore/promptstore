import { Client } from '@elastic/elasticsearch';
import { flatten, unflatten } from 'flat';
import isEmpty from 'lodash.isempty';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

function ElasticsearchService({ __name, constants, logger }) {

  let _client;

  function getClient() {
    if (!_client) {
      const url = `https://${constants.ES_SERVER}:${constants.ES_PORT}`;
      logger.debug('elastic server URL:', url);
      _client = new Client({
        node: url,
        auth: {
          username: constants.ES_USER,
          password: constants.ES_PASS,
        },
      });
    }
    return _client;
  }

  function getCollection(name) {
    return getClient().indices.get({ index: name });
  }

  function getIndexes() {
    try {
      return getClient().indices.get({ index: '*' });
    } catch (err) {
      logger.error(err.message);
      return [];
    }
  }

  async function getIndex(indexName) {
    try {
      const collection = await getCollection(indexName);
      const numDocs = await getClient().count({ index: indexName });
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
      return await getClient().indices.create({
        index: indexName,
      });
    } catch (err) {
      logger.error(err.message);
      throw err;
    }
  }

  async function dropIndex(indexName) {
    try {
      await getClient().indices.delete({ index: indexName });
    } catch (err) {
      logger.error(err.message);
      throw err;
    }
  }

  async function getNumberChunks(indexName) {
    try {
      return await getClient().count({ index: indexName });
    } catch (err) {
      logger.error(err.message, err.stack);
      throw err;
    }
  }

  async function dropData(indexName, { nodeLabel }) {
    try {
      logger.debug("dropping data from collection '%s'", indexName);
      return await getClient().deleteByQuery({
        index: indexName,
        query: {
          match: {
            nodeLabel
          }
        }
      });
    } catch (err) {
      logger.error(err.message, err.stack);
      return [];
    }
  }

  async function indexChunks(chunks, embeddings, { indexName }) {
    try {
      await getClient().bulk({
        index: indexName,
        operations: chunks.map(flatten).flatMap(chunk => [
          {
            index: { _index: indexName },
          },
          chunk,
        ]),
      });
      logger.debug('documents length:', chunks.length);
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
      logger.debug("deleting chunks from collection '%s'", indexName);
      await getClient().bulk({
        index: indexName,
        operations: ids.map(id => ({
          delete: {
            _index: indexName,
            _id: id,
          },
        })),
      });
    } catch (err) {
      logger.error(err.message, err.stack);
    }
  };

  async function deleteChunksMatching(query, attrs, { indexName }) {
    try {
      logger.debug("deleting chunks from collection '%s'", indexName);
      return await getClient().deleteByQuery({
        index: indexName,
        query: {
          match: {
            text: query,
            ...(attrs || {}),
          },
        },
      });
    } catch (err) {
      logger.error(err.message, err.stack);
    }
  }

  async function deleteChunk(id, { indexName }) {
    try {
      logger.debug("deleting chunk from collection '%s'", indexName);
      return await getClient().delete({
        index: indexName,
        id,
      });
    } catch (err) {
      logger.error(err.message, err.stack);
      return [];
    }
  };

  async function search(indexName, q, attrs, logicalType, params) {
    const { k, nodeLabel } = params;
    try {
      const query = {
        bool: {
          must: [
            {
              match: { text: q },
            },
          ],
        },
      };
      if (!isEmpty(attrs)) {
        const filter = Object.entries(attrs).map(([k, v]) => ({
          term: { k: v }
        }));
        query.bool.filter = filter;
      }
      const res = await getClient().search({
        index: indexName,
        query,
      });

      logger.debug('res:', res);
      const hits = res.hits.hits;
      const result = hits.map((hit) => {
        return {
          [nodeLabel]: {
            ...unflatten(hit._source),
            score: hit._score,
          },
        };
      });
      logger.debug('result:', result);
      return result;
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

export default ElasticsearchService;
