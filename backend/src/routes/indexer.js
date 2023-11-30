import { ExtractorEnum } from '../core/indexers/Extractor';
import { LoaderEnum } from '../core/indexers/Loader';

export default ({ app, auth, constants, logger, services, workflowClient }) => {

  const {
    documentsService,
    indexesService,
    uploadsService,
  } = services;

  // cache of results to poll
  const jobs = {};

  const setJobResult = (correlationId) => (result) => {
    // logger.debug('index result:', result);
    if (correlationId) {
      jobs[correlationId] = result;
      setTimeout(() => {  // allow 10m to poll for results
        delete jobs[correlationId];
      }, 10 * 60 * 1000);
    }
  };

  app.get('/api/index-status/:correlationId', auth, async (req, res) => {
    const { correlationId } = req.params;
    // logger.debug('checking index status for:', correlationId);
    const result = jobs[correlationId];
    if (!result) {
      return res.sendStatus(423);
    }
    res.json(result);
    delete jobs[correlationId];
  });

  app.post('/api/index/api', auth, async (req, res) => {
    const { username } = req.user;
    const { correlationId, params, workspaceId } = req.body;
    const {
      textNodeProperties,
      indexId,
      newIndexName,
      embeddingProvider,
      vectorStoreProvider,
      graphStoreProvider,
      endpoint,
      schema: jsonSchema,
      nodeLabel = 'Chunk',
      embeddingNodeProperty = 'embedding',
      similarityMetric = 'cosine',
      allowedNodes,
      allowedRels,
    } = params;

    const indexParams = {
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
    };

    try {
      workflowClient.index(indexParams, LoaderEnum.api, [ExtractorEnum.json], {
        address: constants.TEMPORAL_URL,
      }).then(setJobResult(correlationId));

      res.sendStatus(200);

    } catch (err) {
      logger.error(err);
      res.sendStatus(500);
    }
  });

  /**
   * @openapi
   * components:
   *   schemas:
   *     CrawlInput:
   *       type: object
   *       required:
   *         - url
   *         - spec
   *         - workspaceId
   *       properties:
   *         url:
   *           type: string
   *           description: The URL to crawl
   *         spec:
   *           type: JSONObject
   *           description: The Crawling Spec
   *         maxRequestsPerCrawl:
   *           type: number
   *           description: The maximum number of crawl requests. Once the limit is reached, the crawling process is stopped even if there are more links to follow.
   *         indexId:
   *           type: integer
   *           description: The id of an existing index to use for storing the crawled data
   *         newIndexName:
   *           type: string
   *           description: The name of the new index to create for storing the crawled data
   *         vectorStoreProvider:
   *           type: string
   *           description: The key of the vector store to use for the new index
   *         titleField:
   *           type: string
   *           description: The index field to use as a title in search results
   *         vectorField:
   *           type: string
   *           description: The index field to use for computing embeddings
   *         workspaceId:
   *           type: integer
   *           description: The workspace id. All Prompt Store artefacts are scoped to a workspace.
   */
  /**
   * @openapi
   * tags:
   *   name: Crawler
   *   description: The Crawler Management API
   */

  /**
   * @openapi
   * /api/crawls:
   *   post:
   *     description: Start a web crawl
   *     tags: [Crawler]
   *     requestBody:
   *       description: The crawl specification
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CrawlInput'
   *     responses:
   *       200:
   *         description: A successful crawl
   *       500:
   *         description: Error
   */
  app.post('/api/index/crawler', auth, async (req, res) => {
    const { username } = req.user;
    const { correlationId, params, workspaceId } = req.body;
    const {
      indexId,
      newIndexName,
      embeddingProvider,
      vectorStoreProvider,
      graphStoreProvider,
      dataSourceName,
      url,
      crawlerSpec,
      maxRequestsPerCrawl,
      chunkElement,
      nodeLabel = 'Chunk',
      embeddingNodeProperty = 'embedding',
      similarityMetric = 'cosine',
      allowedNodes,
      allowedRels,
    } = params;

    const indexParams = {
      // Loader params
      dataSourceName,
      url,
      crawlerSpec,
      maxRequestsPerCrawl,

      // Extractor params
      nodeLabel,
      chunkElement,

      // Indexer params
      indexId,
      newIndexName,
      embeddingNodeProperty,
      textNodeProperties,
      similarityMetric,
      embeddingProvider,
      vectorStoreProvider,
      graphStoreProvider,

      // Addtl Graph Store params
      allowedNodes,
      allowedRels,
    };

    try {
      workflowClient.index(indexParams, LoaderEnum.crawler, [ExtractorEnum.crawler], {
        address: constants.TEMPORAL_URL,
      }).then(setJobResult(correlationId));

      res.sendStatus(200);

    } catch (err) {
      logger.error(err);
      res.sendStatus(500);
    }
  });

  app.post('/api/index/graph', auth, async (req, res) => {
    const { username } = req.user;
    const { correlationId, params, workspaceId } = req.body;
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
      sourceIndexId,
    } = params;

    try {
      let sourceIndexName;
      if (sourceIndexId) {
        const sourceIndex = await indexesService.getIndex(sourceIndexId);
        if (sourceIndex) {
          sourceIndexName = sourceIndex.name;
        }
      }

      const indexParams = {
        // Extractor params
        nodeLabel,
        sourceIndexName,
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
      };

      workflowClient.index(indexParams, null, [ExtractorEnum.neo4j], {
        address: constants.TEMPORAL_URL,
      }).then(setJobResult(correlationId));

      res.sendStatus(200);

    } catch (err) {
      logger.error(err, err.stack);
      res.sendStatus(500);
    }
  });

  app.post('/api/index/csv', auth, async (req, res) => {
    const { username } = req.user;
    const { correlationId, documents, params, workspaceId } = req.body;
    const {
      indexId,
      newIndexName,
      embeddingProvider,
      vectorStoreProvider,
      graphStoreProvider,
      textNodeProperties,
      nodeLabel = 'Record',
      embeddingNodeProperty = 'embedding',
      similarityMetric = 'cosine',
      allowedNodes,
      allowedRels,
    } = params;

    try {
      const objectNames = [];
      for (const uploadId of documents) {
        const upload = await uploadsService.getUpload(uploadId);
        const objectName = `${workspaceId}/documents/${upload.filename}`;
        objectNames.push(objectName);
      }

      const indexParams = {
        // Loader params
        objectNames,
        maxBytes: 100000,

        // Extractor params
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
      };

      workflowClient.index(indexParams, LoaderEnum.minio, [ExtractorEnum.csv], {
        address: constants.TEMPORAL_URL,
      }).then(setJobResult(correlationId));

      res.sendStatus(200);

    } catch (err) {
      logger.error(err, err.stack);
      res.sendStatus(500);
    }
  });

  app.post('/api/index/text', auth, async (req, res) => {
    const { username } = req.user;
    const { correlationId, documents, params, workspaceId } = req.body;
    const {
      indexId,
      newIndexName,
      embeddingProvider,
      vectorStoreProvider,
      graphStoreProvider,
      textNodeProperties,
      nodeLabel = 'Chunk',
      splitter,
      characters,
      functionId,
      chunkSize,
      chunkOverlap,
      embeddingNodeProperty = 'embedding',
      similarityMetric = 'cosine',
      allowedNodes,
      allowedRels,
    } = params;

    try {
      const objectNames = [];
      for (const uploadId of documents) {
        const upload = await uploadsService.getUpload(uploadId);
        const objectName = `${workspaceId}/documents/${upload.filename}`;
        objectNames.push(objectName);
      }

      const indexParams = {
        // Loader params
        objectNames,
        maxBytes: 100000,

        // Extractor params
        nodeLabel,
        splitter,
        characters,
        functionId,
        chunkSize,
        chunkOverlap,
        workspaceId,
        username,

        // Indexer params
        indexId,
        newIndexName,
        embeddingNodeProperty,
        textNodeProperties,
        similarityMetric,
        embeddingProvider,
        vectorStoreProvider,
        graphStoreProvider,

        // Addtl Graph Store params
        allowedNodes,
        allowedRels,
      };

      workflowClient.index(indexParams, LoaderEnum.minio, [ExtractorEnum.text], {
        address: constants.TEMPORAL_URL,
      }).then(setJobResult(correlationId));

      res.sendStatus(200);

    } catch (err) {
      logger.error(err, err.stack);
      res.sendStatus(500);
    }
  });

  app.post('/api/index/document', auth, async (req, res) => {
    const { username } = req.user;
    const { correlationId, documents, params, workspaceId } = req.body;
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
    try {
      const docs = [];
      for (const uploadId of documents) {
        const upload = await uploadsService.getUpload(uploadId);
        if (!upload) {
          logger.error('Upload not found:', uploadId);
          // keep processing the other documents
        }
        const objectName = `${upload.workspaceId}/documents/${upload.filename}`;
        logger.debug('Loading', objectName);
        const file = await documentsService.download(objectName);
        docs.push({
          filepath: file.path,
          objectName,
          mimetype: file.mimetype,
          originalname: file.originalname,
        });
      }

      const indexParams = {
        // Extractor params
        documents: docs,
        nodeLabel,

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
      };

      // There are no documents to extract
      // Chunks are extracted directly from the document processor
      workflowClient.index(indexParams, null, [ExtractorEnum.unstructured], {
        address: constants.TEMPORAL_URL,
      }).then(setJobResult(correlationId));

      res.sendStatus(200);

    } catch (err) {
      logger.error(err, err.stack);
      res.sendStatus(500);
    }
  });

  app.post('/api/index/wikipedia', auth, async (req, res) => {
    const { username } = req.user;
    const { correlationId, params, workspaceId } = req.body;
    const {
      query,
      indexId,
      newIndexName,
      embeddingProvider,
      vectorStoreProvider,
      graphStoreProvider,
      textNodeProperties,
      nodeLabel = 'Chunk',
      splitter,
      characters,
      functionId,
      chunkSize,
      chunkOverlap,
      embeddingNodeProperty = 'embedding',
      similarityMetric = 'cosine',
      allowedNodes,
      allowedRels,
    } = params;

    const indexParams = {
      // Loader params
      query,

      // Extractor params
      nodeLabel,
      splitter,
      characters,
      functionId,
      chunkSize,
      chunkOverlap,
      workspaceId,
      username,

      // Indexer params
      indexId,
      newIndexName,
      embeddingNodeProperty,
      textNodeProperties,
      similarityMetric,
      embeddingProvider,
      vectorStoreProvider,
      graphStoreProvider,

      // Addtl Graph Store params
      allowedNodes,
      allowedRels,
    };

    try {
      workflowClient.index(indexParams, LoaderEnum.wikipedia, [ExtractorEnum.text], {
        address: constants.TEMPORAL_URL,
      }).then(setJobResult(correlationId));

    } catch (err) {
      logger.error(err, err.stack);
      res.sendStatus(500);
    }
  });

};
