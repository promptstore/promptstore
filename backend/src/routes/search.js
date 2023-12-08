import { formatAlgolia } from '../utils';

export default ({ app, auth, logger, services }) => {

  const { embeddingService, searchService, vectorStoreService } = services;

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
        const { embedding: testEmbedding } = await embeddingService.createEmbedding(embeddingProvider, { input: 'foo' });
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
      } else if (vectorStoreProvider === 'chroma') {
        resp = await vectorStoreService.createIndex(vectorStoreProvider, indexName, schema);
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
      const res = await embeddingService.createEmbedding(embeddingProvider, { input: q });
      queryEmbedding = res.embedding;
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
