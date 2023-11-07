export default ({ app, auth, logger, services }) => {

  const { crawlerService, indexesService, vectorStoreService } = services;

  // TODO de-duplication

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
  app.post('/api/crawls', async (req, res) => {
    const { username } = req.user;
    const {
      url,
      spec,
      maxRequestsPerCrawl,
      indexId,
      newIndexName,
      nodeLabel,
      embeddingNodeProperty,
      titleField,
      workspaceId,
      vectorField,
    } = req.body;
    const schema = convertScrapingSpecToIndexSchema(spec, vectorField);
    logger.debug('schema:', schema);
    let embeddingProvider;
    let vectorStoreProvider;
    let index;
    if (indexId === 'new') {
      embeddingProvider = params.embeddingProvider;
      vectorStoreProvider = params.vectorStoreProvider;
      let existingIndex;
      if (vectorStoreProvider === 'neo4j') {
        existingIndex = await vectorStoreService.getIndex(vectorStoreProvider, newIndexName, {
          nodeLabel,
          embeddingNodeProperty,
        });
      } else if (vectorStoreProvider === 'redis') {
        existingIndex = await vectorStoreService.getIndex(vectorStoreProvider, newIndexName);
      } else {
        logger.error('Unsupported vector store provider:', vectorStoreProvider);
        return res.sendStatus(400);
      }
      if (!existingIndex) {
        index = await createIndex(workspaceId, username, newIndexName, vectorStoreProvider, schema, {
          embeddingProvider,
          nodeLabel,
          embeddingNodeProperty,
          similarityMetric,
          textNodeProperties,
        });
      }
    const newIndex = await indexesService.upsertIndex({
        name: newIndexName,
        schema,
        titleField,
        workspaceId,
        vectorField,
        vectorStoreProvider,
      });
      logger.debug(`Created new index '${newIndexName}' [${newIndex.id}]`);
      const fields = searchService.getSearchSchema(schema);
      await searchService.createIndex(newIndexName, fields);
      indexName = newIndexName;
    } else {
      const index = await indexesService.getIndex(indexId);

      if (!index) {
        logger.error('Index not found');
        return res.sendStatus(404);
      }

      indexName = index.name;
    }
    const data = await crawlerService.crawl(indexName, url, spec, maxRequestsPerCrawl);
    logger.debug('data:', JSON.stringify(data, null, 2));

    // index data
    const promises = [];
    let doc;
    for (const item of data.items) {
      if (spec.type === 'array') {
        for (const value of item.data) {
          if (spec.items.type === 'string') {
            doc = {
              text: value,
              url: item.url,
              page_title: item.title,
              nodeType: 'content',
            };
          } else {  // `items.type === 'object'`
            doc = {
              ...value,
              url: item.url,
              page_title: item.title,
              nodeType: 'content',
            };
          }
          const promise = searchService.indexDocument(indexName, doc);
          promises.push(promise);
        }
      } else if (spec.type === 'object') {
        for (const item of data.items) {

          doc = {
            ...cleanObject(item.data),
            url: item.url,
            page_title: item.title,
            nodeType: 'content',
          };
          const promise = searchService.indexDocument(indexName, doc);
          promises.push(promise);
        }
      }
    }
    await Promise.all(promises);
    res.sendStatus(200);
  });

  const cleanObject = (obj) => {
    return Object.entries(obj).reduce((a, [k, v]) => {
      if (Array.isArray(v)) {
        a[k] = v.join(', ');
      } else {
        a[k] = v;
      }
      return a;
    }, {});
  };

  const typeMappings = {
    string: 'String',
    number: 'Integer',
  };

  const convertScrapingSpecToIndexSchema = (spec, vectorField) => {
    const { items, type } = spec;
    const schema = { content: {} };
    if (type === 'array') {
      if (items.type === 'string') {
        schema.content = convertStringToIndexSchema();
      }
      if (items.type === 'object') {
        schema.content = convertObjectToIndexSchema(items, vectorField);
      }
    } else if (type === 'string') {
      schema.content = convertStringToIndexSchema();
    } else if (type === 'object') {
      schema.content = convertObjectToIndexSchema(spec, vectorField);
    }
    schema.content = {
      ...schema.content,
      url: {
        name: 'url',
        dataType: 'String',
        mandatory: true,
      },
      page_title: {
        name: 'page_title',
        dataType: 'String',
        mandatory: true,
      },
    }
    return schema;
  };

  const convertObjectToIndexSchema = ({ properties }, vectorField) => {
    return Object.entries(properties).reduce((a, [k, v]) => {
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
      }
      return a;
    }, {});
  };

  const convertStringToIndexSchema = () => {
    return {
      text: {
        name: 'text',
        dataType: 'Vector',
        mandatory: true,
      },
    };
  };

  async function createIndex(workspaceId, username, newIndexName, vectorStoreProvider, schema, params) {
    const {
      embeddingProvider,
      nodeLabel,
      embeddingNodeProperty,
      similarityMetric,
      ...otherParams
    } = params;
    let embeddingDimension;
    if (embeddingProvider) {
      const testEmbedding = await embeddingService.createEmbedding(embeddingProvider, 'foo');
      embeddingDimension = testEmbedding.length;
    }
    const index = await indexesService.upsertIndex({
      name: newIndexName,
      schema,
      workspaceId,
      vectorStoreProvider,
      embeddingProvider,
      embeddingDimension,
      nodeLabel,
      embeddingNodeProperty,
      similarityMetric,
      ...otherParams
    }, username);
    logger.debug(`Created new index '${newIndexName}' [${index.id}]`);
    logger.debug('Node label:', nodeLabel);
    await vectorStoreService.createIndex(vectorStoreProvider, newIndexName, schema, {
      embeddingDimension,
      nodeLabel,
      embeddingNodeProperty,
      similarityMetric,
    });
    return index;
  }

};
