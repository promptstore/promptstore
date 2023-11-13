import { formatAlgolia } from '../utils';

export default ({ app, auth, logger, services }) => {

  const { embeddingService, searchService, vectorStoreService } = services;

  // app.post('/api/workspaces/:workspaceId/index', auth, async (req, res, next) => {
  //   const { workspaceId } = req.params;
  //   const schema = {
  //     content: {
  //       text: {
  //         name: 'text',
  //         dataType: 'String',
  //         mandatory: true,
  //       },
  //     }
  //   };
  //   const indexName = 'workspace-' + workspaceId;
  //   const searchSchema = searchService.getSearchSchema(schema);
  //   await searchService.createIndex(indexName, searchSchema);
  //   res.send('OK');
  // });

  // app.get('/api/index', auth, async (req, res, next) => {
  //   const indexes = await searchService.getIndexes();
  //   res.send(indexes);
  // });

  app.get('/api/index/:vectorStoreProvider/:name', auth, async (req, res, next) => {
    const { name, vectorStoreProvider } = req.params;
    const { nodeLabel } = req.query;
    logger.debug('GET physical index:', name);
    const index = await vectorStoreService.getIndex(vectorStoreProvider, name, { nodeLabel });
    if (!index) {
      return res.sendStatus(404);
    }
    res.send(index);
  });

  app.post('/api/index', auth, async (req, res, next) => {
    const { indexName, schema, params, vectorStoreProvider } = req.body;
    try {
      let resp;
      if (vectorStoreProvider === 'neo4j') {
        const { embeddingProvider, nodeLabel } = params;
        const testEmbedding = await embeddingService.createEmbedding(embeddingProvider, 'foo');
        const embeddingDimension = testEmbedding.length;
        resp = await vectorStoreService.createIndex(vectorStoreProvider, indexName, schema, {
          nodeLabel,
          embeddingDimension,
        });
      } else if (vectorStoreProvider === 'redis') {
        const { nodeLabel } = params;
        resp = await vectorStoreService.createIndex(vectorStoreProvider, indexName, schema, {
          nodeLabel,
        });
      } else {
        throw new Error('Vector store provider not supported: ' + vectorStoreProvider);
      }
      res.send(resp);
    } catch (err) {
      logger.error(String(err));
      res.sendStatus(400);
    }
  });

  app.delete('/api/index/:vectorStoreProvider/:name', auth, async (req, res, next) => {
    const { name, vectorStoreProvider } = req.params;
    try {
      const resp = await vectorStoreService.dropIndex(vectorStoreProvider, name);
      res.send(resp);
    } catch (err) {
      logger.error(String(err));
      res.sendStatus(400);
    }
  });

  app.delete('/api/index/:vectorStoreProvider/:name/data', auth, async (req, res, next) => {
    const { name, vectorStoreProvider } = req.params;
    const { nodeLabel } = req.query;
    try {
      const resp = await vectorStoreService.dropData(vectorStoreProvider, name, { nodeLabel });
      res.send(resp);
    } catch (err) {
      logger.error(String(err));
      res.sendStatus(400);
    }
  });

  // app.post('/api/documents', auth, async (req, res, next) => {
  //   const { documents = [], indexName } = req.body;
  //   logger.debug('documents: ', JSON.stringify(documents, null, 2));
  //   logger.debug('indexName: ', indexName);
  //   const promises = documents.map((doc) => searchService.indexDocument(indexName, doc));
  //   await Promise.all(promises);
  //   res.send({ status: 'OK' });
  // });

  // app.delete('/api/indexes/:indexName/documents/:uid', async (req, res) => {
  //   const { indexName, uid } = req.params;
  //   try {
  //     await searchService.deleteDocument(uid, { indexName });
  //     res.sendStatus(200);
  //   } catch (e) {
  //     logger.log('error', '%s\n%s', e, e.stack);
  //     res.status(500).json({
  //       error: { message: String(e) },
  //     });
  //   }
  // });

  // app.post('/api/bulk-delete', async (req, res) => {
  //   const { indexName, uids } = req.body;
  //   try {
  //     const resp = await searchService.deleteDocuments(uids, { indexName });
  //     res.send(resp);
  //   } catch (err) {
  //     logger.error(String(err));
  //     res.sendStatus(400);
  //   }
  // });

  // app.delete('/api/delete-matching', async (req, res) => {
  //   const { indexName, q, ...rest } = req.query;
  //   try {
  //     await searchService.deleteDocumentsMatching(indexName, q, rest);
  //     res.sendStatus(200);
  //   } catch (e) {
  //     logger.log('error', '%s\n%s', e, e.stack);
  //     res.status(500).json({
  //       error: { message: String(e) },
  //     });
  //   }
  // });

  app.post('/api/search', auth, async (req, res, next) => {
    const { requests, attrs, indexParams } = req.body;
    const { indexName, params: { query } } = requests[0];
    const q = query.trim();
    if (q.length < 2) {
      return [];
    }
    // logger.debug('query:', q);
    const {
      nodeLabel,
      embeddingProvider,
      vectorStoreProvider,
    } = indexParams;
    let queryEmbedding;
    if (vectorStoreProvider !== 'redis') {
      queryEmbedding = await embeddingService.createEmbedding(embeddingProvider, q);
    }
    const rawResults = await vectorStoreService.search(vectorStoreProvider, indexName, q, attrs, {
      queryEmbedding,
    });
    // logger.debug('rawResults:', rawResults);
    const result = formatAlgolia(requests, rawResults, nodeLabel);
    // logger.debug('result:', result);
    res.status(200).send({ results: [result] });
  });

  app.post('/api/sffv', auth, async (req, res, next) => {
    const { requests } = req.body;
    const results = [];
    res.status(200).send(results);
  });

};
