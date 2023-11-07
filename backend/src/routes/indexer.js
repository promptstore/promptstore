import {
  CsvExtractor,
  ExtractorEnum,
  UnstructuredExtractor,
} from '../core/indexers/Extractor';
import { Indexer } from '../core/indexers/Indexer';
import { LoaderEnum } from '../core/indexers/Loader';
import { Pipeline } from '../core/indexers/Pipeline';
import { getExtension } from '../utils';

export default ({ app, auth, logger, services }) => {

  const {
    documentsService,
    embeddingService,
    executionsService,
    extractorService,
    graphStoreService,
    indexesService,
    loaderService,
    uploadsService,
    vectorStoreService,
  } = services;

  app.post('/api/loader/api', auth, async (req, res) => {
    const { username } = req.user;
    const {
      endpoint,
      schema: jsonSchema,
      params,
      workspaceId,
    } = req.body;
    const {
      textNodeProperties,
      indexId,
      newIndexName,
      embeddingProvider,
      vectorStoreProvider,
      graphStoreProvider,
      nodeLabel = 'Chunk',
      embeddingNodeProperty = 'embedding',
      similarityMetric = 'cosine',
      allowedNodes,
      allowedRels,
    } = params;
    try {
      const pipeline = new Pipeline({
        embeddingService,
        executionsService,
        extractorService,
        indexesService,
        graphStoreService,
        loaderService,
        vectorStoreService,
      }, {
        loaderProvider: LoaderEnum.api,
        extractorProvider: ExtractorEnum.json,
      });

      const index = await pipeline.run({
        // Loader params
        endpoint,
        schema: jsonSchema,

        // Extractor params
        jsonSchema,
        textNodeProperties,

        // Indexer params
        indexId,
        newIndexName,
        embeddingProvider,
        vectorStoreProvider,
        graphStoreProvider,
        nodeLabel,
        embeddingNodeProperty,
        similarityMetric,
        workspaceId,
        username,

        // Addtl Graph Store params
        allowedNodes,
        allowedRels,
      });
      res.json({ index: index.id });
    } catch (err) {
      logger.error(err);
      res.sendStatus(500);
    }
  });

  app.post('/api/loader/graph', auth, async (req, res) => {
    const { username } = req.user;
    const { params, workspaceId } = req.body;
    const {
      nodeLabel,
      embeddingNodeProperty = 'embedding',
      textNodeProperties,
      limit,
      indexId,
      newIndexName,
      embeddingProvider,
      vectorStoreProvider,
      graphStoreProvider,
      similarityMetric = 'cosine',
      allowedNodes,
      allowedRels,
    } = params;

    try {
      const pipeline = new Pipeline({
        embeddingService,
        executionsService,
        extractorService,
        indexesService,
        graphStoreService,
        loaderService,
        vectorStoreService,
      }, {
        // There are no documents to extract
        // Chunks are extracted directly from the graphstore
        extractorProvider: ExtractorEnum.neo4j,
      });

      const index = await pipeline.run({
        // Extractor params
        nodeLabel,
        embeddingNodeProperty,
        textNodeProperties,
        limit,

        // Indexer params
        indexId,
        newIndexName,
        embeddingProvider,
        vectorStoreProvider,
        graphStoreProvider,
        similarityMetric,
        workspaceId,
        username,

        // Addtl Graph Store params
        allowedNodes,
        allowedRels,
      });

      res.json({ indexId: index.id });

    } catch (err) {
      logger.error(err);
      res.sendStatus(500);
    }
  });

  app.post('/api/loader/structureddocument', auth, async (req, res) => {
    const { username } = req.user;
    const { documents, params, workspaceId } = req.body;
    const {
      indexId,
      newIndexName,
      embeddingProvider,
      vectorStoreProvider,
      graphStoreProvider,
      nodeLabel = 'Chunk',
      embeddingNodeProperty = 'embedding',
      similarityMetric = 'cosine',
      allowedNodes,
      allowedRels,
    } = params;

    const pipeline = new Pipeline({
      embeddingService,
      executionsService,
      extractorService,
      indexesService,
      graphStoreService,
      loaderService,
      vectorStoreService,
    }, {
      // There are no documents to extract
      // Chunks are extracted directly from the document processor
      extractorProvider: ExtractorEnum.unstructured,
    });

    const unstructuredExtractor = new UnstructuredExtractor(extractorService);
    const indexer = new Indexer({
      embeddingService,
      indexesService,
      vectorStoreService,
    });

    try {
      let schema;
      if (indexId === 'new') {
        schema = await unstructuredExtractor.getSchema();
      }
      const index = await indexer.createOrGetIndex({
        indexId,
        newIndexName,
        schema,
        nodeLabel,
        embeddingNodeProperty,
        similarityMetric,
        workspaceId,
        username,
      });

      for (const uploadId of documents) {
        const upload = await uploadsService.getUpload(uploadId);
        if (!upload) {
          logger.error('Upload not found:', upload);
          // keep processing the other documents
        }
        // logger.debug('upload:', upload);

        const objectName = `${upload.workspaceId}/documents/${upload.filename}`;
        logger.debug('Loading', objectName);
        const file = await documentsService.download(objectName);

        await pipeline.run({
          // Extractor params
          filepath: file.path,
          mimetype: file.mimetype,
          originalname: file.originalname,
          nodeLabel,

          // Indexer params
          index,
          embeddingProvider,
          vectorStoreProvider,
          graphStoreProvider,

          // Addtl Graph Store params
          allowedNodes,
          allowedRels,
        });
      }

      res.json({ indexId: index.id });

    } catch (err) {
      logger.error(err);
      res.sendStatus(500);
    }
  });

  app.post('/api/loader/document', auth, async (req, res) => {
    const { username } = req.user;
    const { documents, params, workspaceId } = req.body;
    const {
      indexId,
      newIndexName,
      embeddingProvider,
      vectorStoreProvider,
      graphStoreProvider,
      textNodeProperties,
      embeddingNodeProperty = 'embedding',
      similarityMetric = 'cosine',
      allowedNodes,
      allowedRels,
    } = params;

    const csvObjects = [];
    const txtObjects = [];
    for (const uploadId of documents) {
      const upload = await uploadsService.getUpload(uploadId);
      const objectName = `${workspaceId}/documents/${upload.filename}`;
      const ext = getExtension(objectName);
      if (ext === 'csv') {
        csvObjects.push(objectName);
      } else if (ext === 'txt') {
        txtObjects.push(objectName);
      } else {
        logger.error('Unsupported file type:', ext);
        // continue
      }
    }

    let content;
    let csvOptions;
    if (csvObjects.length) {
      const csvExtractor = new CsvExtractor(extractorService);
      const defaultOptions = csvExtractor.getDefaultOptions();
      const { delimiter, quote } = params;
      csvOptions = {
        ...defaultOptions,
        ...delimiter && { delimiter },
        ...quote && { quote },
      };

      // get sample content for first object
      if (indexId === 'new') {
        const raw = await documentsService.read(objectName, 10000);
        // strip last maybe malformed record
        content = raw.slice(0, raw.lastIndexOf('\n'));
      }
    }

    const csvPipeline = new Pipeline({
      embeddingService,
      executionsService,
      extractorService,
      indexesService,
      graphStoreService,
      loaderService,
      vectorStoreService,
    }, {
      loaderProvider: LoaderEnum.minio,
      extractorProvider: ExtractorEnum.csv,
    });

    let index;
    for (const objectName of csvObjects) {
      const {
        nodeLabel = 'Record',
      } = params;

      index = await csvPipeline.run({
        // Loader params
        objectName,
        maxBytes: 100000,

        // Extractor params
        content,
        textNodeProperties,
        nodeLabel,
        options: csvOptions,

        // Indexer params
        indexId,
        newIndexName,
        embeddingNodeProperty,
        textNodeProperties,
        similarityMetric,
        embeddingProvider,
        vectorStoreProvider,
        graphStoreProvider,
        workspaceId,
        username,

        // Addtl Graph Store params
        allowedNodes,
        allowedRels,
      });
    }

    const txtPipeline = new Pipeline({
      embeddingService,
      executionsService,
      extractorService,
      indexesService,
      graphStoreService,
      loaderService,
      vectorStoreService,
    }, {
      loaderProvider: LoaderEnum.minio,
      extractorProvider: ExtractorEnum.text,
    });

    for (const objectName of txtObjects) {
      const {
        nodeLabel = 'Chunk',
        splitter,
        characters,
        functionId,
        chunkSize,
        chunkOverlap,
      } = params;

      index = await txtPipeline.run({
        // Loader params
        objectName,
        maxBytes: 100000,

        // Extractor params
        nodeLabel,
        splitter,
        characters,
        functionId,
        chunkSize,
        chunkOverlap,
        objectName,
        workspaceId,
        username,

        // Indexer params
        indexId,
        newIndexName,
        embeddingNodeProperty,
        textNodeProperties,
        similarityMetric,
        schema,
        embeddingProvider,
        vectorStoreProvider,
        graphStoreProvider,

        // Addtl Graph Store params
        allowedNodes,
        allowedRels,
      });
    }

    res.json({ indexId: index.id });
  });


  // ----------------------------------------------------------------------

  const textDocumentSchema_v1 = {
    content: {
      text: {
        name: 'text',
        dataType: 'Vector',
        mandatory: true,
      }
    }
  };

};
