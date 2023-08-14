import axios from 'axios';

export function SearchService({ constants, logger }) {

  const documents = [];

  let intervalId = null;

  async function getIndexes() {
    try {
      const res = await axios.get(constants.SEARCH_API + '/index', {
        headers: {
          'Accept': 'application/json',
        }
      });
      return res.data;
    } catch (err) {
      logger.error(String(err));
      return [];
    }
  }

  async function getIndex(name) {
    try {
      const res = await axios.get(constants.SEARCH_API + '/index/' + encodeURIComponent(name), {
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

  async function createIndex(sourceId, fields) {
    logger.debug('Creating index for source: ', sourceId);
    logger.debug('fields: ', JSON.stringify(fields, null, 2));
    const res = await axios.post(constants.SEARCH_API + '/index', {
      indexName: sourceId,
      fields,
    }, {
      headers: {
        'Content-Type': 'application/json',
      }
    });
    return res.data;
  }

  async function dropIndex(name) {
    try {
      const res = await axios.delete(constants.SEARCH_API + '/index/' + encodeURIComponent(name), {
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

  async function dropData(name) {
    try {
      const res = await axios.delete(constants.SEARCH_API + '/index/' + encodeURIComponent(name) + '/data', {
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

  function sendDocuments(indexName) {
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
      clearInterval(intervalId);
      intervalId = null;

    }
  }

  function indexDocument(indexName, doc) {
    const prefix = doc.nodeType.toLowerCase();
    const value = Object.entries(doc)
      .filter(([k, _]) => notIn(['nodeType'])(k))
      .reduce((a, [k, v]) => {
        a[prefix + '_' + k] = v;
        return a;
      }, {});
    value[prefix + '__label'] = doc.nodeType;
    // logger.debug('value:', value);
    documents.push(value);
    if (!intervalId) {
      intervalId = setInterval(sendDocuments, 1000, indexName);
    }
  }

  async function deleteDocument(indexName, uid) {
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

  async function deleteDocuments(indexName, uids) {
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
      // logger.log('debug', 'search results: %s', res.data);
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
      flds[k.toLowerCase() + '__label'] = {
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
    search,
  };
}
