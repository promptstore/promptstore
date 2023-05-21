const axios = require('axios');

function SearchService({ baseUrl, logger }) {

  const documents = [];

  let intervalId = null;

  async function createIndex(sourceId, fields) {
    logger.debug('Creating index for source:', sourceId);
    logger.debug('fields: ', JSON.stringify(fields, null, 2));
    await axios.post(baseUrl + '/index', {
      indexName: sourceId,
      fields,
    }, {
      headers: {
        'Content-Type': 'application/json',
      }
    });
  }

  function sendDocuments(sourceId) {
    if (documents.length) {
      axios.post(baseUrl + '/document', {
        indexName: sourceId,
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

  const notIn = (arr) => (val) => arr.indexOf(val) === -1;

  function indexDocument(sourceId, doc) {
    const prefix = doc.nodeType.toLowerCase();
    const value = Object.entries(doc)
      .filter(([k, _]) => notIn(['nodeType'])(k))
      .reduce((a, [k, v]) => {
        a[prefix + '_' + k] = v;
        return a;
      }, {});
    value[prefix + '__label'] = doc.nodeType;
    logger.debug('value: ', value);
    documents.push(value);
    if (!intervalId) {
      intervalId = setInterval(sendDocuments, 1000, sourceId);
    }
  }

  async function search(indexName, query) {
    try {
      const res = await axios.get(baseUrl + `/search?indexName=${indexName}&q=${query}`);
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
      case 'String':
      case 'DateTime':
        return 'TEXT';

      case 'Boolean':
        return 'TAG';

      case 'Double':
      case 'Long':
        return 'NUMERIC';

      default:
        return 'TEXT';
    }
  }

  return {
    createIndex,
    indexDocument,
    getSearchSchema,
    search,
  };
}

module.exports = {
  SearchService,
};
