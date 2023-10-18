import axios from 'axios';

function RedisService({ __name, constants, logger }) {

  const documents = [];
  const parentDocuments = [];

  let documentsIntervalId = null;
  let parentDocumentsIntervalId = null;

  async function getIndexes() {
    try {
      const res = await axios.get(constants.SEARCH_API + '/index', {
        headers: {
          'Accept': 'application/json',
        }
      });
      return res.data;
    } catch (err) {
      logger.error(err);
      return [];
    }
  }

  async function getIndex(indexName) {
    try {
      const res = await axios.get(constants.SEARCH_API + '/index/' + encodeURIComponent(indexName), {
        headers: {
          'Accept': 'application/json',
        }
      });
      return res.data;
    } catch (err) {
      logger.error(String(err));
      return null;
    }
  }

  async function createIndex(indexName, { fields }) {
    logger.debug('Creating index for source:', indexName);
    logger.debug('fields:', fields);
    const res = await axios.post(constants.SEARCH_API + '/index', {
      indexName,
      fields,
    }, {
      headers: {
        'Content-Type': 'application/json',
      }
    });
    return res.data;
  }

  async function dropIndex(indexName) {
    try {
      const res = await axios.delete(constants.SEARCH_API + '/index/' + encodeURIComponent(indexName), {
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

  async function dropData({ indexName }) {
    try {
      const res = await axios.delete(constants.SEARCH_API + '/index/' + encodeURIComponent(indexName) + '/data', {
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

  function addDocuments(indexName) {
    if (documents.length) {
      axios.post(constants.SEARCH_API + '/document', {
        indexName,
        documents,
      }, {
        headers: {
          'Content-Type': 'application/json',
        }
      });
      documents.length = 0;
    } else {
      clearInterval(documentsIntervalId);
      documentsIntervalId = null;
    }
  }

  function sendParentDocuments(indexName) {
    if (parentDocuments.length) {
      axios.post(constants.SEARCH_API + '/parent-documents', {
        indexName,
        parentDocuments,
      }, {
        headers: {
          'Content-Type': 'application/json',
        }
      });
      parentDocuments.length = 0;
    } else {
      clearInterval(parentDocumentsIntervalId);
      parentDocumentsIntervalId = null;

    }
  }

  function indexDocument(indexName, doc) {
    const prefix = doc.nodeType.toLowerCase();
    const values = Object.entries(doc)
      .filter(([k, _]) => notIn(['nodeType'])(k))
      .reduce((a, [k, v]) => {
        a[prefix + '_' + k] = v;
        return a;
      }, {});
    values[prefix + '___label'] = doc.nodeType;
    // logger.debug('values:', values);
    documents.push(values);
    if (!documentsIntervalId) {
      documentsIntervalId = setInterval(addDocuments, 1000, indexName);
    }
  }

  function indexParentDocument(indexName, parent) {
    parentDocuments.push(parent);
    if (!parentDocumentsIntervalId) {
      parentDocumentsIntervalId = setInterval(sendParentDocuments, 1000, indexName);
    }
  }

  async function deleteDocument(uid, { indexName }) {
    try {
      await axios.delete(constants.SEARCH_API + '/indexes/' + encodeURIComponent(indexName) + '/documents/' + encodeURIComponent(uid), {
        headers: {
          'Accept': 'application/json',
        }
      });
      return uid;
    } catch (err) {
      logger.error(String(err));
      return null;
    }
  }

  async function deleteDocuments(uids, { indexName }) {
    try {
      await axios.post(constants.SEARCH_API + '/bulk-delete', {
        indexName,
        uids,
      }, {
        headers: {
          'Accept': 'application/json',
        }
      });
      return uids;
    } catch (err) {
      logger.error(String(err));
      return null;
    }
  }

  async function deleteDocumentsMatching(indexName, query, attrs = {}) {
    try {
      const ps = Object.entries(attrs).map(([k, v]) => `${k}=${v}`).join('&');
      let url = constants.SEARCH_API + '/delete-matching?indexName=' + encodeURIComponent(indexName);
      if (query) {
        url += '&q=' + query;
      }
      if (ps) {
        url += '&' + ps;
      }
      await axios.delete(url, {
        headers: {
          'Accept': 'application/json',
        }
      });
    } catch (err) {
      logger.error(String(err));
    }
  }

  async function search(indexName, query, attrs = {}) {
    logger.log('debug', 'searching %s for "%s"', indexName, query);
    try {
      const ps = Object.entries(attrs).map(([k, v]) => `${k}=${v}`).join('&');
      let url = constants.SEARCH_API + '/search?indexName=' + encodeURIComponent(indexName);
      if (query) {
        url += `&q=` + encodeURIComponent(query);
      }
      if (ps) {
        url += '&' + ps;
      }
      const res = await axios.get(url);
      logger.debug('search results:', res.data);
      return res.data;
    } catch (err) {
      logger.error(err);
      return [];
    }
  }

  function getSearchSchema(schema) {
    const fields = Object.entries(schema).reduce((a, [k, v]) => {
      const flds = Object.entries(v).reduce((b, [key, val]) => {
        b[k.toLowerCase() + '_' + key.toLowerCase()] = {
          type: getSearchType(val.dataType),
        };
        return b
      }, a);
      flds[k.toLowerCase() + '___label'] = {
        type: 'TEXT'
      };
      return flds;
    }, {});
    return fields;
  }

  function getSearchType(dataType) {
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

  const notIn = (arr) => (val) => arr.indexOf(val) === -1;

  return {
    __name,
    createIndex,
    deleteDocuments,
    deleteDocumentsMatching,
    deleteDocument,
    dropData,
    dropIndex,
    getIndexes,
    getIndex,
    getSearchSchema,
    indexDocument,
    indexParentDocument,
    search,
  };
}

export default RedisService;
