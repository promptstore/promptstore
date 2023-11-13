import { ExtractorEnum } from '../core/indexers/Extractor';
import { LoaderEnum } from '../core/indexers/Loader';
import { Pipeline } from '../core/indexers/Pipeline';

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

  app.post('/api/index/api', auth, async (req, res) => {
    const { username } = req.user;
    const {
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
      endpoint,
      schema: jsonSchema,
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
        extractorProvider: [ExtractorEnum.json],
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
    const {
      params,
      workspaceId
    } = req.body;
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
        loaderProvider: LoaderEnum.crawler,
        extractorProviders: [ExtractorEnum.crawler],
      });

      const index = await pipeline.run({
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
      });

      res.json({ indexId: index.id });
    } catch (err) {
      logger.error(err);
      res.sendStatus(500);
    }
  });

  app.post('/api/index/graph', auth, async (req, res) => {
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
        extractorProviders: [ExtractorEnum.neo4j],
      });

      const index = await pipeline.run({
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
      });

      res.json({ indexId: index.id });

    } catch (err) {
      logger.error(err, err.stack);
      res.sendStatus(500);
    }
  });

  app.post('/api/index/csv', auth, async (req, res) => {
    const { username } = req.user;
    const { documents, params, workspaceId } = req.body;
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

    const objectNames = [];
    for (const uploadId of documents) {
      const upload = await uploadsService.getUpload(uploadId);
      const objectName = `${workspaceId}/documents/${upload.filename}`;
      objectNames.push(objectName);
    }

    const pipeline = new Pipeline({
      embeddingService,
      executionsService,
      extractorService,
      indexesService,
      graphStoreService,
      loaderService,
      vectorStoreService,
    }, {
      loaderProvider: LoaderEnum.minio,
      extractorProviders: [ExtractorEnum.csv],
    });

    const index = await pipeline.run({
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
    });

    res.json({ indexId: index.id });
  });

  app.post('/api/index/text', auth, async (req, res) => {
    const { username } = req.user;
    const { documents, params, workspaceId } = req.body;
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

    const objectNames = [];
    for (const uploadId of documents) {
      const upload = await uploadsService.getUpload(uploadId);
      const objectName = `${workspaceId}/documents/${upload.filename}`;
      objectNames.push(objectName);
    }

    const pipeline = new Pipeline({
      embeddingService,
      executionsService,
      extractorService,
      indexesService,
      graphStoreService,
      loaderService,
      vectorStoreService,
    }, {
      loaderProvider: LoaderEnum.minio,
      extractorProviders: [ExtractorEnum.text],
    });

    const index = await pipeline.run({
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
    });

    res.json({ indexId: index.id });
  });

  app.post('/api/index/document', auth, async (req, res) => {
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
      extractorProviders: [ExtractorEnum.unstructured],
    });

    try {
      let docs;
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

      const index = await pipeline.run({
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
      });

      res.json({ indexId: index.id });

    } catch (err) {
      logger.error(err);
      res.sendStatus(500);
    }
  });

  app.post('/api/index/wikipedia', auth, async (req, res) => {
    const { username } = req.user;
    const { params, workspaceId } = req.body;
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

    const pipeline = new Pipeline({
      embeddingService,
      executionsService,
      extractorService,
      indexesService,
      graphStoreService,
      loaderService,
      vectorStoreService,
    }, {
      loaderProvider: LoaderEnum.wikipedia,
      extractorProviders: [ExtractorEnum.text],
    });

    const index = await pipeline.run({
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
    });

    res.json({ indexId: index.id });
  });

};
