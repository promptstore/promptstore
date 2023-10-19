import { Table } from 'tableschema';
import unescapeJs from 'unescape-js';

import { getExtension } from '../utils';

const nodeType = 'content';

const typeMappings = {
  'string': 'String',
  'integer': 'Integer',
  'boolean': 'Boolean',
};

export default ({ app, auth, logger, services }) => {

  const {
    documentsService,
    embeddingService,
    executionsService,
    functionsService,
    graphStoreService,
    indexesService,
    loaderService,
    searchService,
    uploadsService,
    vectorStoreService,
  } = services;

  app.post('/api/loader/api', auth, async (req, res) => {
    const { endpoint, schema, params, workspaceId } = req.body;
    const { newIndexName, engine, vectorField } = params;
    let indexId = params.indexId;
    if (indexId === 'new') {
      indexId = await createIndexFromJsonSchema(workspaceId, newIndexName, engine, vectorField, schema);
      await indexApi(endpoint, schema, { ...params, indexId });
    } else {
      await indexApi(endpoint, schema, params);
    }
    res.json({ indexId });
  });

  app.post('/api/loader/graph', auth, async (req, res) => {
    const { params, workspaceId } = req.body;
    const {
      newIndexName,
      graphstore,
      embedding,
      nodeLabel,
      embeddingNodeProperty,
      textNodeProperties,
      similarityMetric = 'cosine',
    } = params;
    let engine;
    let indexId = params.indexId;
    if (indexId === 'new') {
      engine = params.engine;
      if (engine === 'neo4j') {
        const existingIndex = await vectorStoreService.getIndex(engine, newIndexName, {
          nodeLabel,
          embeddingNodeProperty,
        });
        if (!existingIndex) {
          const schema = await graphStoreService.getSchema(graphstore, { nodeLabel });
          const testEmbedding = await embeddingService.createEmbedding(embedding, 'foo');
          const embeddingDimension = testEmbedding.length;
          const index = await indexesService.upsertIndex({
            name: newIndexName,
            engine,
            embedding,
            embeddingDimension,
            nodeLabel,
            embeddingNodeProperty,
            textNodeProperties,
            similarityMetric,
            schema,
            workspaceId,
          });
          logger.debug(`Created new index '${newIndexName}' [${index.id}]`);
          indexId = index.id;
          await vectorStoreService.createIndex(engine, newIndexName, schema, {
            nodeLabel,
            embeddingNodeProperty,
            embeddingDimension,
            similarityMetric,
          });
        }
      } else if (engine === 'redis') {
        const existingIndex = await vectorStoreService.getIndex(engine, newIndexName);
        if (!existingIndex) {
          const schema = await graphStoreService.getSchema(graphstore, { nodeLabel });
          const testEmbedding = await embeddingService.createEmbedding(embedding, 'foo');
          const embeddingDimension = testEmbedding.length;
          const index = await indexesService.upsertIndex({
            name: newIndexName,
            engine,
            embedding,
            embeddingDimension,
            nodeLabel,
            embeddingNodeProperty,
            textNodeProperties,
            similarityMetric,
            schema,
            workspaceId,
          });
          logger.debug(`Created new index '${newIndexName}' [${index.id}]`);
          indexId = index.id;
          const fields = searchService.getSearchSchema(schema);
          await searchService.createIndex(newIndexName, fields);
        }
      } else {
        logger.error('Unsupported engine:', engine);
        return res.sendStatus(400);
      }
    } else {
      const index = await indexesService.getIndex(indexId);
      if (!index) {
        logger.error('Index not found:', indexId);
        return res.sendStatus(404);
      }
      engine = index.engine;
    }
    const docs = await graphStoreService.getDocuments(graphstore, {
      nodeLabel,
      embeddingNodeProperty,
      textNodeProperties,
    });
    if (engine === 'neo4j') {
      const proms = docs.map(d => embeddingService.createEmbedding('sentenceencoder', d.__text));
      const embeddings = await Promise.all(proms).catch((err) => {
        logger.error(err);
        throw err;
      });
      await vectorStoreService.addDocuments(engine, docs, embeddings, {
        nodeLabel,
        embeddingNodeProperty,
      });
    } else if (engine === 'redis') {
      await indexDocs(indexId, docs);
    } else {
      logger.error('Unsupported engine:', engine);
      return res.sendStatus(400);
    }
    res.json({ indexId });
  });

  app.post('/api/loader/structureddocument', auth, async (req, res) => {
    const { params, documents, workspaceId } = req.body;
    const { newIndexName, engine } = params;
    let indexId = params.indexId;
    if (indexId === 'new') {
      indexId = await createStructuredDocumentIndex(workspaceId, newIndexName, engine);
      await indexStructuredDocuments(documents, { ...params, indexId });
    } else {
      await indexStructuredDocuments(documents, params);
    }
    res.json({ indexId });
  });

  app.post('/api/loader/document', auth, async (req, res) => {
    const { username } = req.user;
    const { filepath, params, workspaceId } = req.body;
    const { newIndexName, engine } = params;
    const ext = getExtension(filepath);

    let indexId = params.indexId;
    if (ext === 'csv') {
      if (indexId === 'new') {
        indexId = await createIndexFromCsv(workspaceId, newIndexName, engine, filepath, params);
        await indexCsv(filepath, { ...params, indexId });
      } else {
        await indexCsv(filepath, params);
      }

    } else if (ext === 'txt') {
      if (indexId === 'new') {
        indexId = await createTextDocumentIndex(workspaceId, newIndexName, engine, params);
        await indexTextDocument(workspaceId, username, filepath, { ...params, indexId });
      } else {
        await indexTextDocument(workspaceId, username, filepath, params);
      }

    } else {
      throw new Error('File type not supported');
    }

    res.json({ indexId });
  });


  // ---- create indexes ---- //

  async function createIndexFromCsv(workspaceId, newIndexName, engine, filepath, params) {
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
    const indexSchema = convertTableSchemaToIndexSchema(descriptor, params.vectorField);
    const index = await indexesService.upsertIndex({
      name: newIndexName,
      engine,
      schema: indexSchema,
      titleField: params.titleField,
      vectorField: params.vectorField,
      workspaceId,
    });
    logger.debug(`Created new index '${newIndexName}' [${index.id}]`);
    const fields = searchService.getSearchSchema(indexSchema);
    await searchService.createIndex(newIndexName, fields);
    return index.id;
  }

  async function createIndexFromGraph(workspaceId, newIndexName, engine, params) {
    const index = await indexesService.upsertIndex({
      name: newIndexName,
      engine,
      params,
      workspaceId,
    });
    logger.debug(`Created new index '${newIndexName}' [${index.id}]`);
    await vectorStoreService.createIndex(newIndexName, params);
    return index.id;
  }

  async function createIndexFromJsonSchema(workspaceId, newIndexName, engine, vectorField, jsonSchema) {
    const indexSchema = convertJsonSchemaToIndexSchema(jsonSchema, vectorField);
    const index = await indexesService.upsertIndex({
      name: newIndexName,
      engine,
      schema: indexSchema,
      workspaceId,
    });
    logger.debug(`Created new index '${newIndexName}' [${index.id}]`);
    const fields = searchService.getSearchSchema(indexSchema);
    await searchService.createIndex(newIndexName, fields);
    return index.id;
  }

  async function createStructuredDocumentIndex(workspaceId, newIndexName, engine) {
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
        parent_uids: {
          name: 'parent_uids',
          dataType: 'String',
          mandatory: true,
        },
        uid: {
          name: 'uid',
          dataType: 'String',
          mandatory: true,
        },
      }
    };
    const index = await indexesService.upsertIndex({
      name: newIndexName,
      engine,
      schema: indexSchema,
      workspaceId,
    });
    logger.debug(`Created new index '${newIndexName}' [${index.id}]`);
    const fields = searchService.getSearchSchema(indexSchema);
    await searchService.createIndex(newIndexName, fields);
    return index.id;
  }

  async function createTextDocumentIndex(workspaceId, newIndexName, engine, params) {
    const indexSchema = {
      content: {
        text: {
          name: 'text',
          dataType: 'Vector',
          mandatory: true,
        }
      }
    };
    const index = await indexesService.upsertIndex({
      name: newIndexName,
      engine,
      schema: indexSchema,
      titleField: params.titleField,
      vectorField: params.vectorField,
      workspaceId,
    });
    logger.debug(`Created new index '${newIndexName}' [${index.id}]`);
    const fields = searchService.getSearchSchema(indexSchema);
    await searchService.createIndex(newIndexName, fields);
    return index.id;
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

  const convertTableSchemaToIndexSchema = (descriptor, vectorField) => {
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
    const { chunks } = await loaderService.load('api', { endpoint, schema, nodeType });
    await indexDocs(indexId, chunks);
  }

  async function indexCsv(filepath, params) {
    const {
      delimiter = ',',
      indexId,
      quote = '"',
    } = params;
    const text = await documentsService.read(filepath);
    const { chunks } = await loaderService.load('csv', {
      delimiter,
      nodeType,
      quote,
      text,
    });
    await indexDocs(indexId, chunks);
  }

  async function indexGraph(graphstore, params) {
    const docs = await graphStoreService.getDocuments(graphstore, params);
    logger.debug('docs:', docs);
  }

  // async function indexStructuredDocument(uploadId, { indexId }) {
  //   const upload = await uploadsService.getUpload(uploadId);
  //   if (!upload) {
  //     throw new Error('Upload not found');
  //   }
  //   const { chunks } = await loaderService.load('structureddocument', { upload, nodeType });
  //   await indexDocs(indexId, chunks);
  // }

  async function indexStructuredDocuments(documents, { indexId }) {
    const index = await indexesService.getIndex(indexId);
    if (!index) {
      throw new Error('Index not found');
    }
    for (const uploadId of documents) {
      const upload = await uploadsService.getUpload(uploadId);
      if (!upload) {
        // throw new Error('Upload not found');
        logger.error(`Upload ${uploadId} not found`);
        // keep processing the other documents
      }
      logger.debug('Loading', upload.filename);
      const { chunks, documents } = await loaderService.load('structureddocument', { upload, nodeType });
      if (documents && documents.length) {
        await indexParentDocuments(index, documents);
      }
      await indexDocuments(index, chunks);
    }
  }

  async function indexTextDocument(workspaceId, username, filepath, params) {
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
      const { response, errors } = await executionsService.executeFunction({
        workspaceId,
        username,
        semanticFunctionName: 'chunk',
        args: { text },
      });
      chunks = response.chunks;

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
    const indexChunk = (chunk) => searchService.indexDocument(index.name, chunk);
    const promises = chunks.map(indexChunk);
    await Promise.all(promises);
  }

  async function indexDocuments(index, chunks) {
    const indexChunk = (chunk) => searchService.indexDocument(index.name, chunk);
    const promises = chunks.map(indexChunk);
    await Promise.all(promises);
  }

  async function indexParentDocuments(index, documents) {
    const indexDoc = (doc) => searchService.indexParentDocument(index.name, doc);
    const promises = documents.map(indexDoc);
    await Promise.all(promises);
  }

};
