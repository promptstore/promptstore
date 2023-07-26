const { Table } = require('tableschema');
const unescapeJs = require('unescape-js');

const { getExtension } = require('../utils');

const nodeType = 'content';

const typeMappings = {
  'string': 'String',
  'integer': 'Integer',
};

module.exports = ({ app, auth, logger, services }) => {

  const {
    documentsService,
    executionsService,
    functionsService,
    indexesService,
    loaderService,
    searchService,
    uploadsService,
  } = services;

  app.post('/api/loader/api', auth, async (req, res) => {
    const { endpoint, schema, params } = req.body;
    const { newIndexName, engine, vectorField } = params;
    let indexId = params.indexId;
    if (indexId === 'new') {
      indexId = await createIndexFromJsonSchema(newIndexName, engine, vectorField, schema);
      await indexApi(endpoint, schema, { ...params, indexId });
    } else {
      await indexApi(endpoint, schema, params);
    }
    res.json({ indexId });
  });

  app.post('/api/loader/structureddocument', auth, async (req, res) => {
    const { uploadId, params } = req.body;
    const { newIndexName, engine } = params;
    let indexId = params.indexId;
    if (indexId === 'new') {
      indexId = await createStructuredDocumentIndex(newIndexName, engine);
      await indexStructuredDocument(uploadId, { ...params, indexId });
    } else {
      await indexStructuredDocument(uploadId, params);
    }
    res.json({ indexId });
  });

  app.post('/api/loader/document', auth, async (req, res) => {
    const { filepath, params } = req.body;
    const { newIndexName, engine } = params;
    const ext = getExtension(filepath);

    let indexId = params.indexId;
    if (ext === 'csv') {
      if (indexId === 'new') {
        indexId = await createIndexFromCsv(newIndexName, engine, filepath, params);
        await indexCsv(filepath, { ...params, indexId });
      } else {
        await indexCsv(filepath, params);
      }

    } else if (ext === 'txt') {
      if (indexId === 'new') {
        indexId = await createTextDocumentIndex(newIndexName, engine, params);
        await indexTextDocument(filepath, { ...params, indexId });
      } else {
        await indexTextDocument(filepath, params);
      }

    } else {
      throw new Error('File type not supported');
    }

    res.json({ indexId });
  });


  // ---- create indexes ---- //

  async function createIndexFromCsv(newIndexName, engine, filepath, params) {
    const options = {
      bom: true,
      delimiter: params.delimiter,
      quote: params.quote,
      skip_records_with_error: true,
      trim: true,
    };
    const csv = await documentsService.read(filepath, 10000, documentsService.transformations.csv, options);
    const table = await Table.load(csv);
    await table.infer();
    const descriptor = table.schema.descriptor;
    logger.debug('descriptor:', descriptor);
    logger.debug('vectorField:', params.vectorField);
    const indexSchema = convertSqlSchemaToIndexSchema(descriptor, params.vectorField);
    const indexId = await indexesService.upsertIndex({
      name: newIndexName,
      engine,
      schema: indexSchema,
      titleField: params.titleField,
      vectorField: params.vectorField,
    });
    logger.debug(`Created new index '${newIndexName}' [${indexId}]`);
    const fields = searchService.getSearchSchema(indexSchema);
    await searchService.createIndex(newIndexName, fields);
    return indexId;
  }

  async function createIndexFromJsonSchema(newIndexName, engine, vectorField, jsonSchema) {
    const indexSchema = convertJsonSchemaToIndexSchema(jsonSchema, vectorField);
    const indexId = await indexesService.upsertIndex({
      name: newIndexName,
      engine,
      schema: indexSchema,
    });
    logger.debug(`Created new index '${newIndexName}' [${indexId}]`);
    const fields = searchService.getSearchSchema(indexSchema);
    await searchService.createIndex(newIndexName, fields);
    return indexId;
  }

  async function createStructuredDocumentIndex(newIndexName, engine) {
    const indexSchema = {
      content: {
        text: {
          name: 'text',
          dataType: 'Vector',
          mandatory: true,
        },
        type: {
          name: 'type',
          dataType: 'String',
          mandatory: true,
        },
        subtype: {
          name: 'subtype',
          dataType: 'String',
          mandatory: true,
        },
      }
    };
    const indexId = await indexesService.upsertIndex({
      name: newIndexName,
      engine,
      schema: indexSchema,
    });
    logger.debug(`Created new index '${newIndexName}' [${indexId}]`);
    const fields = searchService.getSearchSchema(indexSchema);
    await searchService.createIndex(newIndexName, fields);
    return indexId;
  }

  async function createTextDocumentIndex(newIndexName, engine, params) {
    const indexSchema = {
      content: {
        text: {
          name: 'text',
          dataType: 'Vector',
          mandatory: true,
        }
      }
    };
    const indexId = await indexesService.upsertIndex({
      name: newIndexName,
      engine,
      schema: indexSchema,
      titleField: params.titleField,
      vectorField: params.vectorField,
    });
    logger.debug(`Created new index '${newIndexName}' [${indexId}]`);
    const fields = searchService.getSearchSchema(indexSchema);
    await searchService.createIndex(newIndexName, fields);
    return indexId;
  }


  // ---- convert schemas ---- //

  const convertJsonSchemaToIndexSchema = (schema, vectorField) => {

    const convertObject = (props) => {
      return Object.entries(props).reduce((a, [k, v]) => {
        let dataType;
        if (k === vectorField) {
          dataType = 'Vector';
        } else {
          dataType = typeMappings[v.type] || 'String';
        }
        a[k] = {
          name: k,
          dataType,
          mandatory: false,
        };
        return a;
      }, {});
    };

    const convertSimpleType = (type) => {
      if (type === 'string') {
        return {
          text: {
            name: 'text',
            dataType: 'Vector',
            mandatory: false,
          }
        };
      } else {
        return {
          text: {
            name: 'text',
            dataType: typeMappings[type] || 'String',
            mandatory: false,
          }
        };
      }
    };

    let content;
    if (schema.type === 'array') {
      if (schema.items.type === 'object') {
        content = convertObject(schema.items.properties);
      } else {
        content = convertSimpleType(schema.items.type);
      }
    } else if (schema.type === 'object') {
      content = convertObject(schema.properties);
    } else {
      content = convertSimpleType(schema.type);
    }
    return { content };
  };

  const convertSqlSchemaToIndexSchema = (descriptor, vectorField) => {
    const props = descriptor.fields.reduce((a, f) => {
      let dataType;
      if (f.name === vectorField) {
        dataType = 'Vector';
      } else {
        dataType = typeMappings[f.type] || 'String';
      }
      a[f.name] = {
        name: f.name,
        dataType,
        mandatory: false,
      };
      return a;
    }, {});
    return { content: props };
  };


  // ---- index documents ---- //

  async function indexApi(endpoint, schema, { indexId }) {
    const docs = await loaderService.load('api', { endpoint, schema, nodeType });
    await indexDocs(indexId, docs);
  }

  async function indexCsv(filepath, params) {
    const {
      delimiter = ',',
      indexId,
      quote = '"',
    } = params;
    const text = await documentsService.read(filepath);
    const docs = await loaderService.load('csv', {
      delimiter,
      nodeType,
      quote,
      text,
    });
    await indexDocs(indexId, docs);
  }

  async function indexStructuredDocument(uploadId, { indexId }) {
    const upload = await uploadsService.getUpload(uploadId);
    if (!upload) {
      throw new Error('Upload not found');
    }
    const docs = await loaderService.load('structureddocument', { upload, nodeType });
    await indexDocs(indexId, docs);
  }

  async function indexTextDocument(filepath, params) {
    const {
      characters = '\n\n',
      functionId,
      indexId,
      splitter,
      textProperty = 'text',
    } = params;
    const text = await documentsService.read(filepath);
    let chunks;
    if (splitter === 'delimiter') {
      // Needing this library to unescape `\\n\\n` back to new-line characters
      // `unescape` or `decodeURIComponent` is not working
      chunks = text.split(unescapeJs(characters));

    } else if (splitter === 'chunker') {
      const func = await functionsService.getFunction(functionId);
      if (!func) {
        throw new Error('Chunker function not found');
      }
      const res = await executionsService.executeFunction('chunk', { text });
      chunks = res.chunks;

    } else {
      throw new Error('Splitter not supported');
    }

    const docs = chunks.map((chunk) => ({ [textProperty]: chunk, nodeType }));
    await indexDocs(indexId, docs);
  }

  async function indexDocs(indexId, chunks) {
    const index = await indexesService.getIndex(indexId);
    if (!index) {
      throw new Error('Index not found');
    }
    const indexDoc = (doc) => searchService.indexDocument(index.name, doc);
    const promises = chunks.map(indexDoc);
    await Promise.all(promises);
  }

};
