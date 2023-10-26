import axios from 'axios';
import isObject from 'lodash.isobject';

export function SearchService({ constants, logger, services }) {

  const { embeddingService, vectorStoreService } = services;

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
      logger.error(String(err));
      return [];
    }
  }

  async function getIndex(indexName) {
    try {
      const res = await axios.get(constants.SEARCH_API + '/index/' + encodeURIComponent(`idx:${indexName}`), {
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
      const res = await axios.delete(constants.SEARCH_API + '/index/' + encodeURIComponent(`idx:${name}`), {
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
    logger.debug('doc:', doc);
    const prefix = doc.nodeType.toLowerCase();
    const value = Object.entries(doc)
      .filter(([k, _]) => notIn(['nodeType'])(k))
      .reduce((a, [k, v]) => {
        if (isObject(v)) {
          if (v.nodeType && v.__id) {
            for (const [k1, v1] of Object.entries(v)) {
              if (!['__id', 'nodeType'].includes(k1)) {
                a[v.nodeType.toLowerCase() + '_' + k1] = v1;
              }
            }
            a[prefix + '_' + k] = v.__id;
          }
        } else {
          a[prefix + '_' + k] = v;
        }
        return a;
      }, {});

    value[prefix + '___label'] = doc.nodeType;
    logger.debug('value:', value);
    documents.push(value);
    if (!documentsIntervalId) {
      documentsIntervalId = setInterval(sendDocuments, 1000, indexName);
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

  async function search(vectorStoreProvider, indexName, query, attrs = {}, params = {}) {
    logger.log('debug', 'searching %s for "%s"', indexName, query);
    const q = query.trim();
    if (q.length < 3) {
      return [];
    }
    try {
      if (vectorStoreProvider === 'neo4j') {
        const { embeddingProvider } = params;
        const queryEmbedding = await embeddingService.createEmbedding(embeddingProvider, q);
        return vectorStoreService.search('neo4j', indexName, query, attrs, {
          queryEmbedding,
        });
      }
      const ps = Object.entries(attrs).map(([k, v]) => `${k}=${v}`).join('&');
      let url = constants.SEARCH_API + '/search?indexName=' + encodeURIComponent(indexName);
      if (q) {
        url += `&q=` + encodeURIComponent(q);
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
      case 'Id':
      case 'object':
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
    indexParentDocument,
    search,
  };
}
