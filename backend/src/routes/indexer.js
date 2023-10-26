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
    extractorService,
    functionsService,
    graphStoreService,
    indexesService,
    loaderService,
    searchService,
    uploadsService,
    vectorStoreService,
  } = services;

  app.post('/api/loader/api', auth, async (req, res) => {
    const { endpoint, schema: apiJsonSchema, params, workspaceId } = req.body;
    const { newIndexName, vectorStoreProvider } = params;
    const indexId = params.indexId;
    let index;
    if (indexId === 'new') {
      const schema = await extractorService.getSchema('json', { apiJsonSchema });
      index = await createIndexFromApi(workspaceId, newIndexName, vectorStoreProvider, schema);
    } else {
      index = await indexesService.getIndex(indexId);
    }

    // [ Load ] --> [ Extract ] --> [ Index ]
    const documents = await loaderService.load('api', {
      endpoint,
      schema: apiJsonSchema,
    });
    const chunks = await extractorService.getChunks('json', documents, {
      apiJsonSchema,
      textNodeProperties,
    });
    await vectorStoreService.indexChunks(vectorStoreProvider, chunks, null, {
      indexName: index.name,
    });
    res.json({ indexId: index.id });
  });

  app.post('/api/loader/graph', auth, async (req, res) => {
    const { params, workspaceId } = req.body;
    const {
      newIndexName,
      graphstore,
      nodeLabel,
      embeddingNodeProperty,
      textNodeProperties,
      similarityMetric = 'cosine',
    } = params;
    let embeddingProvider;
    let vectorStoreProvider;
    const indexId = params.indexId;
    let index;
    if (indexId === 'new') {
      embeddingProvider = params.embeddingProvider;
      vectorStoreProvider = params.vectorStoreProvider;
      if (vectorStoreProvider === graphstore) {
        const existingIndex = await vectorStoreService.getIndex(vectorStoreProvider, newIndexName, {
          nodeLabel,
          embeddingNodeProperty,
        });
        if (!existingIndex) {
          const schema = await extractorService.getSchema(graphstore, { nodeLabel });
          index = await createIndexFromGraph(workspaceId, newIndexName, vectorStoreProvider, schema, {
            embeddingProvider,
            nodeLabel,
            embeddingNodeProperty,
            textNodeProperties,
            similarityMetric,
          });
        }
      } else if (vectorStoreProvider === 'redis') {
        const existingIndex = await vectorStoreService.getIndex(vectorStoreProvider, newIndexName);
        if (!existingIndex) {
          const schema = await extractorService.getSchema(graphstore, { nodeLabel });
          index = await createIndexFromGraph(workspaceId, newIndexName, vectorStoreProvider, schema, {
            embeddingProvider,
            nodeLabel,
            embeddingNodeProperty,
            textNodeProperties,
            similarityMetric,
          });
        }
      } else {
        logger.error('Unsupported vector store provider:', vectorStoreProvider);
        return res.sendStatus(400);
      }
    } else {
      index = await indexesService.getIndex(indexId);
      if (!index) {
        logger.error('Index not found:', indexId);
        return res.sendStatus(404);
      }
      embeddingProvider = index.embeddingProvider;
      vectorStoreProvider = index.vectorStoreProvider;
    }
    const chunks = await extractorService.getChunks('neo4j', null, {
      nodeLabel,
      embeddingNodeProperty,
      textNodeProperties,
    });
    if (vectorStoreProvider === graphstore) {
      const proms = chunks.map(chunk => embeddingService.createEmbedding(embeddingProvider, chunk.__text));
      const embeddings = await Promise.all(proms).catch((err) => {
        logger.error(err);
        throw err;
      });
      await vectorStoreService.indexChunks(vectorStoreProvider, chunks, embeddings, {
        nodeLabel,
        embeddingNodeProperty,
      });
    } else if (vectorStoreProvider === 'redis') {
      await vectorStoreService.indexChunks(vectorStoreProvider, chunks, null, {
        indexName: index.name,
        nodeLabel,
      });
    } else {
      logger.error('Unsupported vector store provider:', vectorStoreProvider);
      return res.sendStatus(400);
    }
    res.json({ indexId: index.id });
  });

  app.post('/api/loader/structureddocument', auth, async (req, res) => {
    const { documents, params, workspaceId } = req.body;
    const { indexId, newIndexName, vectorStoreProvider } = params;
    let index;
    if (indexId === 'new') {
      const schema = await loaderService.getSchema('structureddocument');
      index = await createIndexFromStructuredDocument(workspaceId, newIndexName, vectorStoreProvider, schema);
      await indexStructuredDocuments(documents, { ...params, indexId });
    } else {
      index = await indexesService.getIndex(indexId);
      await indexStructuredDocuments(documents, params);
    }
    if (!index) {
      throw new Error('Index not found');
    }
    res.json({ indexId: index.id });
  });

  app.post('/api/loader/document', auth, async (req, res) => {
    const { username } = req.user;
    const { objectName, params, workspaceId } = req.body;
    const { indexId, newIndexName, textNodeProperties, titleField, vectorStoreProvider } = params;
    const ext = getExtension(objectName);
    let index;
    let chunks;
    if (ext === 'csv') {
      const documents = await loaderService.getDocuments('minio', {
        objectName,
        maxBytes: 10000,
      });
      const options = {
        ...loaderService.getDefaultOptions(),
        delimiter: params.delimiter,
        quote: params.quote,
      };
      chunks = await extractorService.getChunks('csv', documents, {
        textNodeProperties,
        options,
      });
      if (indexId === 'new') {
        // sample first 100 rows to infer schema
        const csv = documents[0].content
          .split('\n')
          .slice(0, 101)
          .slice(0, -1)  // strip last maybe malformed record
          ;
        index = await createIndexFromCsv(workspaceId, newIndexName, vectorStoreProvider, csv, textNodeProperties, titleField);
      } else {
        index = await indexesService.getIndex(indexId);
      }
      if (!index) {
        throw new Error('Index not found');
      }

    } else if (ext === 'txt') {
      if (indexId === 'new') {
        index = await createIndexFromTextDocument(workspaceId, newIndexName, vectorStoreProvider, params);
      } else {
        index = await indexesService.getIndex(indexId);
      }
      if (!index) {
        throw new Error('Index not found');
      }
      docs = await getDocumentsFromText(workspaceId, username, filepath, params);

    } else {
      throw new Error('File type not supported');
    }

    await vectorStoreService.addChunks(vectorStoreProvider, chunks, null, {
      indexName: index.name,
    });

    res.json({ indexId: index.id });
  });


  // ---- create indexes ---- //

  async function createIndexFromApi(workspaceId, newIndexName, vectorStoreProvider, schema) {
    const index = await indexesService.upsertIndex({
      name: newIndexName,
      schema,
      workspaceId,
      vectorStoreProvider,
    });
    logger.debug(`Created new index '${newIndexName}' [${index.id}]`);
    await vectorStoreService.createIndex(vectorStoreProvider, newIndexName, schema);
    return index;
  }

  async function createIndexFromCsv(workspaceId, newIndexName, vectorStoreProvider, csv, textNodeProperties, titleField) {
    const schema = await extractorService.getSchema('csv', {
      csv,
      textNodeProperties,
    });
    const index = await indexesService.upsertIndex({
      name: newIndexName,
      schema,
      workspaceId,
      vectorStoreProvider,
      titleField,
      vectorField,
    });
    logger.debug(`Created new index '${newIndexName}' [${index.id}]`);
    await vectorStoreService.createIndex(vectorStoreProvider, newIndexName, schema);
    return index;
  }

  async function createIndexFromGraph(workspaceId, newIndexName, vectorStoreProvider, schema, params) {
    const {
      embeddingProvider,
      nodeLabel,
      embeddingNodeProperty,
      textNodeProperties,
      similarityMetric,
    } = params;
    const testEmbedding = await embeddingService.createEmbedding(embeddingProvider, 'foo');
    const embeddingDimension = testEmbedding.length;
    const index = await indexesService.upsertIndex({
      name: newIndexName,
      schema,
      workspaceId,
      vectorStoreProvider,
      embeddingProvider,
      embeddingDimension,
      nodeLabel,
      embeddingNodeProperty,
      textNodeProperties,
      similarityMetric,
    });
    logger.debug(`Created new index '${newIndexName}' [${index.id}]`);
    await vectorStoreService.createIndex(vectorStoreProvider, newIndexName, schema, {
      embeddingDimension,
      nodeLabel,
      embeddingNodeProperty,
      similarityMetric,
    });
    return index.id;
  }

  async function createIndexFromStructuredDocument(workspaceId, newIndexName, vectorStoreProvider, schema) {
    const index = await indexesService.upsertIndex({
      name: newIndexName,
      schema,
      workspaceId,
      vectorStoreProvider,
    });
    logger.debug(`Created new index '${newIndexName}' [${index.id}]`);
    await vectorStoreService.createIndex(vectorStoreProvider, newIndexName, schema);
    return index;
  }

  async function createIndexFromTextDocument(workspaceId, newIndexName, vectorStoreProvider, params) {
    const schema = {
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
      schema,
      workspaceId,
      vectorStoreProvider,
      titleField: params.titleField,
      vectorField: params.vectorField,
    });
    logger.debug(`Created new index '${newIndexName}' [${index.id}]`);
    await vectorStoreService.createIndex(vectorStoreProvider, newIndexName, schema);
    return index;
  }


  // ---- index documents ---- //

  async function indexApi(endpoint, schema, { indexId }) {
    const { chunks } = await loaderService.load('api', { endpoint, schema, nodeType });
    await indexDocs(indexId, chunks);
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

  async function getDocumentsFromText(workspaceId, username, filepath, params) {
    const {
      characters = '\n\n',
      functionId,
      nodeType,
      splitter,
      textProperty = 'text',
    } = params;
    const text = await documentsService.read(filepath, 10000);
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

    return chunks.map((chunk) => ({ [textProperty]: chunk, nodeType }));
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

  async function indexDocuments(indexName, vectorStoreProvider, chunks) {
    const indexChunk = (chunk) => vectorStoreProvider.indexDocument(vectorStoreProvider, indexName, chunk);
    const promises = chunks.map(indexChunk);
    await Promise.all(promises);
  }

  async function indexParentDocuments(index, documents) {
    const indexDoc = (doc) => searchService.indexParentDocument(index.name, doc);
    const promises = documents.map(indexDoc);
    await Promise.all(promises);
  }

};
