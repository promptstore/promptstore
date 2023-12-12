import axios from 'axios';
import { unflatten } from 'flat';
import isEmpty from 'lodash.isempty';
import isObject from 'lodash.isobject';

const BATCH_SIZE = 100;
const SEND_DOCUMENT_INTERVAL = 1000;

function RedisService({ __name, constants, logger }) {

  const _chunks = [];
  const _parentChunks = [];

  let _sendChunksIntervalId = null;
  let _sendParentChunksIntervalId = null;

  async function getIndexes() {
    try {
      const url = constants.SEARCH_API + '/index';
      const res = await axios.get(url, {
        headers: {
          'Accept': 'application/json',
        }
      });
      return res.data;
    } catch (err) {
      logger.error(err);
      throw err;
    }
  }

  async function getIndex(indexName) {
    try {
      const url = constants.SEARCH_API + '/index/' + encodeURIComponent(indexName);
      const res = await axios.get(url, {
        headers: {
          'Accept': 'application/json',
        }
      });
      return res.data;
    } catch (err) {
      logger.error(err);
      return null;
    }
  }

  async function createIndex(indexName, schema, params) {
    logger.debug('Creating index:', indexName);
    const { nodeLabel, vectorField } = params;
    try {
      const fields = getSearchSchema(schema, nodeLabel, vectorField);
      logger.debug('fields:', fields);
      const url = constants.SEARCH_API + '/index';
      const res = await axios.post(url, {
        indexName,
        fields,
      }, {
        headers: {
          'Content-Type': 'application/json',
        }
      });
      return res.data;
    } catch (err) {
      logger.error(err, err.stack);
      throw err;
    }
  }

  async function dropIndex(indexName) {
    try {
      const url = constants.SEARCH_API + '/index/' + encodeURIComponent(indexName);
      const res = await axios.delete(url, {
        headers: {
          'Accept': 'application/json',
        }
      });
      return res.data;
    } catch (err) {
      logger.error(err);
      throw err;
    }
  }

  async function getNumberChunks(indexName) {
    try {
      const index = await getIndex(indexName);
      return index.numDocs;
    } catch (err) {
      logger.error(err);
      throw err;
    }
  }

  async function dropData(indexName) {
    try {
      const url = constants.SEARCH_API + '/index/' + encodeURIComponent(indexName) + '/data';
      const res = await axios.delete(url, {
        headers: {
          'Accept': 'application/json',
        }
      });
      return res.data;
    } catch (err) {
      logger.error(err);
      throw err;
    }
  }

  function indexChunks(chunks, embeddings, params) {
    if (!embeddings) {
      embeddings = [];
    }
    chunks.forEach((chunk, i) => indexChunk(chunk, embeddings[i], params));
  }

  function indexChunk(chunk, embedding, { indexName, nodeLabel }) {
    const values = Object.entries(chunk)
      .reduce((a, [k, v]) => {
        if (isObject(v)) {
          a[nodeLabel + '.' + k] = JSON.stringify(v);
        } else {
          a[nodeLabel + '.' + k] = v;
        }
        return a;
      }, {});
    _chunks.push(values);
    if (!_sendChunksIntervalId) {
      _sendChunksIntervalId = setInterval(sendChunks, SEND_DOCUMENT_INTERVAL, indexName, nodeLabel);
    }
  }

  function indexParentChunk(chunk, embedding, { indexName }) {
    _parentChunks.push(chunk);
    if (!_sendParentChunksIntervalId) {
      _sendParentChunksIntervalId = setInterval(sendParentChunks, SEND_DOCUMENT_INTERVAL, indexName);
    }
  }

  async function deleteChunks(ids, { indexName }) {
    try {
      const url = constants.SEARCH_API + '/bulk-delete';
      await axios.post(url, {
        indexName,
        uids: ids,
      }, {
        headers: {
          'Accept': 'application/json',
        }
      });
      return ids;
    } catch (err) {
      logger.error(err);
      throw err;
    }
  }

  async function deleteChunk(id, { indexName }) {
    try {
      const url =
        constants.SEARCH_API + '/indexes/' + encodeURIComponent(indexName) +
        '/documents/' + encodeURIComponent(id);
      await axios.delete(url, {
        headers: {
          'Accept': 'application/json',
        }
      });
      return id;
    } catch (err) {
      logger.error(err);
      throw err;
    }
  }

  async function deleteChunksMatching(query, attrs, { indexName }) {
    if (!attrs) {
      attrs = {};
    }
    try {
      const attribs = Object.entries(attrs).map(([k, v]) => `${k}=${v}`).join('&');
      let url = constants.SEARCH_API + '/delete-matching?indexName=' + encodeURIComponent(indexName);
      if (query) {
        url += '&q=' + query;
      }
      if (!isEmpty(attribs)) {
        url += '&' + attribs;
      }
      await axios.delete(url, {
        headers: {
          'Accept': 'application/json',
        }
      });
    } catch (err) {
      logger.error(err);
      throw err;
    }
  }

  async function search(indexName, query, attrs, logicalType) {
    logger.debug('searching %s for "%s"', indexName, query);
    if (!attrs) attrs = {};
    try {
      const attribs = Object.entries(attrs)
        .map(([k, v]) => `${k}=${v}`).join('&');
      let url = constants.SEARCH_API + '/search?indexName=' + encodeURIComponent(indexName);
      if (query) {
        url += `&q=` + encodeURIComponent(query);
      }
      if (!isEmpty(attribs)) {
        url += '&' + attribs;
        if (logicalType) {
          url += '&logicalType=' + logicalType;
        }
      }
      const res = await axios.get(url);
      return res.data
        .map(d => Object.entries(d).reduce((a, [k, v]) => {
          const key = k.replace(/__/g, '.');
          a[key] = v;
          return a;
        }, {}))
        .map(unflatten);
    } catch (err) {
      logger.error(err, err.stack);
      return [];
    }
  }


  // ----------------------------------------------------------------------

  function getSearchSchema(jsonschema, nodeLabel, vectorField) {
    if (jsonschema.type === 'array') {
      return getSearchSchema(jsonschema.items, nodeLabel, vectorField);
    }
    const fields = Object.entries(jsonschema.properties).reduce((a, [k, v]) => {
      const prop = nodeLabel + '.' + k;
      if (v.$ref) {
        const refLabel = v.$ref.split('/').pop();
        const refProps = jsonschema.definitions[refLabel].properties;
        for (const [key, val] of Object.entries(refProps)) {
          if (!val.$ref && val.type !== 'object') {
            let type;
            if (key === 'id') {
              type = 'TAG';
            } else if (key === vectorField) {
              type = 'VECTOR';
            } else {
              type = getSearchType(val.type);
            }
            a[prop + '.' + key] = { type };
          }
        }
      } else {
        let type;
        if (k === 'id') {
          type = 'TAG';
        } else if (k === vectorField) {
          type = 'VECTOR';
        } else {
          type = getSearchType(v.type);
        }
        a[prop] = { type };
      }
      return a;
    }, {});
    if (nodeLabel === 'Chunk') {
      fields[nodeLabel + '.id'] = { type: 'TAG' };
      fields[nodeLabel + '.nodeLabel'] = { type: 'TAG' };
      fields[nodeLabel + '.type'] = { type: 'TAG' };
      fields[nodeLabel + '.documentId'] = { type: 'TAG' };
      fields[nodeLabel + '.text'] = { type: 'VECTOR' };
      fields[nodeLabel + '.metadata.author'] = { type: 'TAG' };
      fields[nodeLabel + '.metadata.mimetype'] = { type: 'TAG' };
      fields[nodeLabel + '.metadata.objectName'] = { type: 'TAG' };
      fields[nodeLabel + '.metadata.endpoint'] = { type: 'TAG' };
      fields[nodeLabel + '.metadata.database'] = { type: 'TAG' };
      fields[nodeLabel + '.metadata.subtype'] = { type: 'TAG' };
      fields[nodeLabel + '.metadata.parentIds'] = { type: 'TAG' };
      fields[nodeLabel + '.metadata.page'] = { type: 'TAG' };
      fields[nodeLabel + '.metadata.row'] = { type: 'TAG' };
      fields[nodeLabel + '.metadata.wordCount'] = { type: 'NUMERIC' };
      fields[nodeLabel + '.metadata.length'] = { type: 'NUMERIC' };
      fields[nodeLabel + '.metadata.size'] = { type: 'NUMERIC' };
      fields[nodeLabel + '.createdDatetime'] = { type: 'TAG' };
      fields[nodeLabel + '.createdBy'] = { type: 'TAG' };
      fields[nodeLabel + '.startDatetime'] = { type: 'TAG' };
      fields[nodeLabel + '.endDatetime'] = { type: 'TAG' };
      fields[nodeLabel + '.version'] = { type: 'NUMERIC' };
    }
    return fields;
  }

  function getSearchType(type) {
    switch (type) {
      case 'string':
        return 'TEXT';

      case 'boolean':
        return 'TAG';

      case 'number':
        return 'NUMERIC';

      default:
        return 'TEXT';
    }
  }

  function sendChunks(indexName, nodeLabel) {
    if (_chunks.length) {
      const chunks = _chunks.splice(-BATCH_SIZE, BATCH_SIZE);
      axios.post(constants.SEARCH_API + '/document', {
        documents: chunks,
        indexName,
        nodeLabel,
      }, {
        headers: {
          'Content-Type': 'application/json',
        }
      });
    } else {
      clearInterval(_sendChunksIntervalId);
      _sendChunksIntervalId = null;
    }
  }

  function sendParentChunks(indexName) {
    if (_parentChunks.length) {
      const chunks = _parentChunks.splice(-BATCH_SIZE, BATCH_SIZE);
      axios.post(constants.SEARCH_API + '/parent-documents', {
        parentDocuments: chunks,
        indexName,
      }, {
        headers: {
          'Content-Type': 'application/json',
        }
      });
      _parentChunks.length = 0;
    } else {
      clearInterval(_sendParentChunksIntervalId);
      _sendParentChunksIntervalId = null;
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
    getSearchSchema,
    indexChunks,
    indexChunk,
    indexParentChunk,
    search,
  };
}

export default RedisService;
