import { formatAlgolia } from '../utils';

import searchFunctions from '../searchFunctions';
import searchableObjects from '../searchableObjects';

export default ({ app, auth, constants, logger, services }) => {

  const {
    agentsService,
    appsService,
    compositionsService,
    dataSourcesService,
    destinationsService,
    functionsService,
    indexesService,
    llmService,
    modelsService,
    promptSetsService,
    transformationsService,
    uploadsService,
    workspacesService,
    vectorStoreService,
  } = services;

  const { indexObject } = searchFunctions({ constants, services });

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
        const { embedding: testEmbedding } = await llmService.createEmbedding(embeddingProvider, { input: 'foo' });
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

  app.post('/api/chunks/:vectorStoreProvider/:name', auth, async (req, res, next) => {
    const { name, vectorStoreProvider } = req.params;
    const { chunks, embeddings, params } = req.body;
    try {
      const resp = await vectorStoreService.indexChunks(vectorStoreProvider, chunks, embeddings, {
        ...params,
        indexName: name,
      });
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

  app.post('/api/bulk-delete', async (req, res) => {
    const { ids, params, vectorStoreProvider } = req.body;
    try {
      const resp = await vectorStoreService.deleteChunks(vectorStoreProvider, ids, params);
      res.send(resp);
    } catch (err) {
      logger.error(String(err));
      res.sendStatus(400);
    }
  });

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
    const { requests, attrs, logicalType, indexParams } = req.body;
    const { indexName, params: { query } } = requests[0];
    // logger.debug('query:', q);
    const {
      nodeLabel,
      embeddingProvider,
      vectorStoreProvider,
    } = indexParams;
    const q = query.trim();
    if (q.length < 2) {
      const result = formatAlgolia(requests, [], nodeLabel);
      return res.status(200).send({ results: [result] });
    }
    let queryEmbedding;
    if (vectorStoreProvider !== 'redis') {
      const res = await llmService.createEmbedding(embeddingProvider, { input: q });
      queryEmbedding = res.embedding;
    }
    const rawResults = await vectorStoreService.search(vectorStoreProvider, indexName, q, attrs, logicalType, {
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

  const serviceMapping = {
    agents: agentsService.getAgents,
    apps: appsService.getApps,
    compositions: compositionsService.getCompositions,
    dataSources: dataSourcesService.getDataSources,
    destinations: destinationsService.getDestinations,
    functions: functionsService.getFunctions,
    indexes: indexesService.getIndexes,
    models: modelsService.getModels,
    promptSets: promptSetsService.getPromptSets,
    transformations: transformationsService.getTransformations,
    uploads: uploadsService.getUploads,
  };

  app.post('/api/workspaces/:workspaceId/rebuild-search-index', auth, async (req, res, next) => {
    const { workspaceId } = req.params;
    try {
      for (const key of Object.keys(serviceMapping)) {
        const records = await serviceMapping[key](workspaceId);
        for (const rec of records) {
          const obj = searchableObjects[key](rec);
          await indexObject(obj);
        }
      }
      const rec = await workspacesService.getWorkspace(workspaceId);
      const obj = searchableObjects['workspaces'](rec);
      await indexObject(obj);
      res.json({ status: 'OK' });
    } catch (err) {
      logger.debug('Error rebuilding search index:', err, err.stack);
      res.sendStatus(500);
    }
  });

};
