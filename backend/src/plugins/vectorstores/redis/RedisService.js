import axios from 'axios';
import camelCase from 'lodash.camelcase';
import isEmpty from 'lodash.isempty';

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
      throw err;
    }
  }

  async function createIndex(indexName, schema) {
    logger.debug('Creating index for source:', indexName);
    try {
      const fields = getSearchSchema(schema);
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

  function indexChunks(chunks, embeddings = [], params) {
    chunks.forEach((chunk, i) => indexChunk(chunk, embeddings[i], params));
  }

  function indexChunk(chunk, embedding, { indexName, nodeLabel }) {
    const prefix = camelCase(nodeLabel).toLowerCase();
    const values = Object.entries(chunk)
      .filter(([k, _]) => k !== 'nodeLabel')
      .reduce((a, [k, v]) => {
        a[prefix + '_' + k] = v;
        return a;
      }, {});
    values[prefix + '___label'] = chunk.nodeLabel;
    // logger.debug('values:', values);
    _chunks.push(values);
    if (!_sendChunksIntervalId) {
      _sendChunksIntervalId = setInterval(sendChunks, SEND_DOCUMENT_INTERVAL, indexName);
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

  async function deleteChunksMatching(query, attrs = {}, { indexName }) {
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

  async function search(indexName, query, attrs = {}) {
    logger.log('debug', 'searching %s for "%s"', indexName, query);
    try {
      const attribs = Object.entries(attrs).map(([k, v]) => `${k}=${v}`).join('&');
      let url = constants.SEARCH_API + '/search?indexName=' + encodeURIComponent(indexName);
      if (query) {
        url += `&q=` + encodeURIComponent(query);
      }
      if (!isEmpty(attribs)) {
        url += '&' + attribs;
      }
      const res = await axios.get(url);
      // logger.debug('search results:', res.data);
      return res.data;
    } catch (err) {
      logger.error(err, err.stack);
      return [];
    }
  }


  // ----------------------------------------------------------------------

  function getSearchSchema(jsonschema, nodeLabel) {
    if (jsonschema.type === 'array') {
      return getSearchSchema(jsonschema.items, nodeLabel);
    }
    const prefix = camelCase(nodeLabel).toLowerCase();
    const fields = Object.entries(jsonschema.properties).reduce((a, [k, v]) => {
      const prop = prefix + '_' + camelCase(k).toLowerCase();
      const type = v.tag ? 'TAG' : getSearchType(v.type);
      a[prop] = { type };
    }, {});
    fields[prefix + '___id'] = { type: 'TAG' };
    fields[prefix + '___label'] = { type: 'TAG' };
    fields[prefix + '___document_id'] = { type: 'TAG' };
    fields[prefix + '___type'] = { type: 'TAG' };
    fields[prefix + '___text'] = { type: 'VECTOR' };
    fields[prefix + '___created_datetime'] = { type: 'TAG' };
    fields[prefix + '___author'] = { type: 'TAG' };
    fields[prefix + '___mimetype'] = { type: 'TAG' };
    fields[prefix + '___object_name'] = { type: 'TAG' };
    fields[prefix + '___endpoint'] = { type: 'TAG' };
    fields[prefix + '___subtype'] = { type: 'TAG' };
    fields[prefix + '___parent_ids'] = { type: 'TAG' };
    fields[prefix + '___page'] = { type: 'TAG' };
    fields[prefix + '___row'] = { type: 'TAG' };
    fields[prefix + '___word_count'] = { type: 'NUMERIC' };
    fields[prefix + '___length'] = { type: 'NUMERIC' };
    fields[prefix + '___size'] = { type: 'NUMERIC' };
    fields[prefix + '___created_datetime'] = { type: 'TAG' };
    fields[prefix + '___created_by'] = { type: 'TAG' };
    fields[prefix + '___start_datetime'] = { type: 'TAG' };
    fields[prefix + '___end_datetime'] = { type: 'TAG' };
    fields[prefix + '___version'] = { type: 'NUMERIC' };
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

  function sendChunks(indexName) {
    if (_chunks.length) {
      const chunks = _chunks.splice(-BATCH_SIZE, BATCH_SIZE);
      axios.post(constants.SEARCH_API + '/document', {
        indexName,
        documents: chunks,
      }, {
        headers: {
          'Content-Type': 'application/json',
        }
      });
      _chunks.length = 0;
    } else {
      clearInterval(_sendChunksIntervalId);
      _sendChunksIntervalId = null;
    }
  }

  function sendParentChunks(indexName) {
    if (_parentChunks.length) {
      const chunks = _parentChunks.splice(-BATCH_SIZE, BATCH_SIZE);
      axios.post(constants.SEARCH_API + '/parent-documents', {
        indexName,
        parentDocuments: chunks,
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

  function getSearchSchema_v1(schema) {
    const prefix = camelCase(nodeLabel).toLowerCase();
    const fields = Object.entries(schema).reduce((a, [k, v]) => {
      const flds = Object.entries(v).reduce((b, [key, val]) => {
        b[prefix + '_' + camelCase(key).toLowerCase()] = {
          type: getSearchType_v1(val.dataType),
        };
        return b;
      }, a);
      flds[prefix + '___label'] = { type: 'TAG' };
      return flds;
    }, {});
    return fields;
  }

  function getSearchType_v1(dataType) {
    switch (dataType) {
      case 'Vector':
        return 'VECTOR';

      case 'String':
      case 'DateTime':
        return 'TEXT';

      case 'Boolean':
        return 'TAG';

      case 'Double':
      case 'Long':
      case 'Integer':
        return 'NUMERIC';

      default:
        return 'TEXT';
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
