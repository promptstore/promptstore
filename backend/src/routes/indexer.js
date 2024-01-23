import searchFunctions from '../searchFunctions';

export default ({ app, auth, constants, logger, services, workflowClient }) => {

  const OBJECT_TYPE = 'indexes';

  const {
    appsService,
    documentsService,
    indexesService,
    modelsService,
    uploadsService,
  } = services;

  const { indexObject } = searchFunctions({ constants, logger, services });

  // cache of results to poll
  const _jobs = {};

  const getJobResult = (correlationId) => {
    return _jobs[correlationId];
  };

  const setJobResult = (correlationId, result) => {
    _jobs[correlationId] = result;
    setTimeout(() => {  // allow 10m to poll for results
      delete _jobs[correlationId];
    }, 10 * 60 * 1000);
  };

  const unsetJobResult = (correlationId) => {
    delete _jobs[correlationId];
  };

  app.get('/api/index-status/:correlationId', auth, async (req, res) => {
    const { correlationId } = req.params;
    logger.debug('checking index status for:', correlationId);
    const result = getJobResult(correlationId);
    if (!result) {
      return res.sendStatus(423);
    }
    res.json(result);
    unsetJobResult(correlationId);
  });

  app.post('/api/index/api', auth, async (req, res) => {
    const { username } = req.user;
    const { correlationId, params, workspaceId } = req.body;
    const {
      textNodeProperties,
      indexId,
      newIndexName,
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
      let embeddingModel;
      if (params.embeddingModel) {
        const model = await modelsService.getModelByKey(workspaceId, params.embeddingModel);
        if (model) {
          embeddingModel = {
            provider: model.provider,
            model: model.key,
          };
        }
      }

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
        embeddingModel,
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

      workflowClient.index(indexParams, 'api', ['json'], {
        address: constants.TEMPORAL_URL,
      }).then((results) => {
        const index = results[0];
        setJobResult(correlationId, index);
        const obj = createSearchableObject(index, { source: 'api' });
        indexObject(obj);
      });

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
      let embeddingModel;
      if (params.embeddingModel) {
        const model = await modelsService.getModelByKey(workspaceId, params.embeddingModel);
        if (model) {
          embeddingModel = {
            provider: model.provider,
            model: model.key,
          };
        }
      }

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
        embeddingModel,
        vectorStoreProvider,
        graphStoreProvider,

        // Addtl Graph Store params
        allowedNodes,
        allowedRels,
      };

      workflowClient.index(indexParams, 'crawler', ['crawler'], {
        address: constants.TEMPORAL_URL,
      }).then(results => {
        const index = results[0];
        setJobResult(correlationId, index);
        const obj = createSearchableObject(index, { source: 'crawler' });
        indexObject(obj);
      });

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
      vectorStoreProvider,
      graphStoreProvider,
      similarityMetric = 'cosine',
      allowedNodes,
      allowedRels,
      sourceIndexId,
    } = params;
    try {
      let embeddingModel;
      if (params.embeddingModel) {
        const model = await modelsService.getModelByKey(workspaceId, params.embeddingModel);
        if (model) {
          embeddingModel = {
            provider: model.provider,
            model: model.key,
          };
        }
      }

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
        embeddingModel,
        vectorStoreProvider,
        graphStoreProvider,
        similarityMetric,
        workspaceId,
        username,

        // Addtl Graph Store params
        allowedNodes,
        allowedRels,
      };

      workflowClient.index(indexParams, null, ['neo4j'], {
        address: constants.TEMPORAL_URL,
      }).then(results => {
        const index = results[0];
        setJobResult(correlationId, index);
        const obj = createSearchableObject(index, { source: 'graph' });
        indexObject(obj);
      });

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
      let embeddingModel;
      if (params.embeddingModel) {
        const model = await modelsService.getModelByKey(workspaceId, params.embeddingModel);
        if (model) {
          embeddingModel = {
            provider: model.provider,
            model: model.key,
          };
        }
      }

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
        embeddingModel,
        vectorStoreProvider,
        graphStoreProvider,
        workspaceId,
        username,

        // Addtl Graph Store params
        allowedNodes,
        allowedRels,
      };

      workflowClient.index(indexParams, 'minio', ['csv'], {
        address: constants.TEMPORAL_URL,
      }).then(results => {
        const index = results[0];
        setJobResult(correlationId, index);
        const obj = createSearchableObject(index, { source: 'csv' });
        indexObject(obj);
      });

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
      let embeddingModel;
      if (params.embeddingModel) {
        const model = await modelsService.getModelByKey(workspaceId, params.embeddingModel);
        if (model) {
          embeddingModel = {
            provider: model.provider,
            model: model.key,
          };
        }
      }

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
        embeddingModel,
        vectorStoreProvider,
        graphStoreProvider,

        // Addtl Graph Store params
        allowedNodes,
        allowedRels,
      };

      workflowClient.index(indexParams, 'minio', ['text'], {
        address: constants.TEMPORAL_URL,
      }).then(results => {
        const index = results[0]
        setJobResult(correlationId, index);
        const obj = createSearchableObject(index, { source: 'csv' });
        indexObject(obj);
      });

      res.sendStatus(200);

    } catch (err) {
      logger.error(err, err.stack);
      res.sendStatus(500);
    }
  });

  app.post('/api/index/document', auth, async (req, res) => {
    const { username } = req.user;
    const { appId, correlationId, documents, params, workspaceId } = req.body;
    const {
      indexId,
      newIndexName,
      vectorStoreProvider,
      graphStoreProvider,
      nodeLabel = 'Chunk',
      embeddingNodeProperty = 'embedding',
      similarityMetric = 'cosine',
      allowedNodes,
      allowedRels,
    } = params;
    try {
      let embeddingModel;
      if (params.embeddingModel) {
        const model = await modelsService.getModelByKey(workspaceId, params.embeddingModel);
        if (model) {
          embeddingModel = {
            provider: model.provider,
            model: model.key,
          };
        }
      }

      const docs = [];
      for (const uploadId of documents) {
        const upload = await uploadsService.getUpload(uploadId);
        if (!upload) {
          logger.error('Upload not found:', uploadId);
          // keep processing the other documents
        }
        let objectName;
        if (appId) {
          objectName = `${upload.workspaceId}/documents/apps/${appId}/${upload.filename}`;
        } else {
          objectName = `${upload.workspaceId}/documents/${upload.filename}`;
        }
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
        embeddingModel,
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
      workflowClient.index(indexParams, null, ['unstructured'], {
        address: constants.TEMPORAL_URL,
      }).then(async (results) => {
        const index = results[0];
        setJobResult(correlationId, index);
        if (appId) {
          const indexId = index.id;
          const uploadId = documents[0];
          const app = await appsService.getApp(appId);
          const indexes = app.indexes || [];
          await appsService.upsertApp({
            id: appId,
            indexes: [...indexes, indexId],
            documents: {
              ...app.documents,
              [uploadId]: {
                ...app.documents?.[uploadId],
                index: indexId,
              },
            },
          });
        }
        const obj = createSearchableObject(index, { source: 'unstructured' });
        indexObject(obj);
      });

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
      let embeddingModel;
      if (params.embeddingModel) {
        const model = await modelsService.getModelByKey(workspaceId, params.embeddingModel);
        if (model) {
          embeddingModel = {
            provider: model.provider,
            model: model.key,
          };
        }
      }

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
        embeddingModel,
        vectorStoreProvider,
        graphStoreProvider,

        // Addtl Graph Store params
        allowedNodes,
        allowedRels,
      };

      workflowClient.index(indexParams, 'wikipedia', ['text'], {
        address: constants.TEMPORAL_URL,
      }).then(results => {
        const index = results[0];
        setJobResult(correlationId, index);
        const obj = createSearchableObject(index, { source: 'wikipedia' });
        indexObject(obj);
      });

    } catch (err) {
      logger.error(err, err.stack);
      res.sendStatus(500);
    }
  });

  const objectId = (id) => OBJECT_TYPE + ':' + id;

  function createSearchableObject(rec, metadata) {
    const texts = [
      rec.name,
      rec.description,
    ];
    const text = texts.filter(t => t).join('\n');
    return {
      id: objectId(rec.id),
      nodeLabel: 'Object',
      label: 'Semantic Index',
      type: OBJECT_TYPE,
      name: rec.name,
      text,
      createdDateTime: rec.created,
      createdBy: rec.createdBy,
      workspaceId: String(rec.workspaceId),
      metadata: {
        embeddingProvider: rec.embeddingModel?.provider,
        embeddingModel: rec.embeddingModel?.model,
        vectorStoreProvider: rec.vectorStoreProvider,
        graphStoreProvider: rec.graphStoreProvider,
        ...metadata,
      },
    };
  }

};
