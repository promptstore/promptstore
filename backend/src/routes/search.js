module.exports = ({ app, auth, logger, services }) => {

  const { searchService } = services;

  app.post('/api/workspaces/:workspaceId/index', auth, async (req, res, next) => {
    const { workspaceId } = req.params;
    const schema = {
      content: {
        text: {
          name: 'text',
          dataType: 'String',
          mandatory: true,
        },
      }
    };
    const indexName = 'workspace-' + workspaceId;
    const searchSchema = searchService.getSearchSchema(schema);
    await searchService.createIndex(indexName, searchSchema);
    res.send('OK');
  });

  app.get('/api/index', auth, async (req, res, next) => {
    const indexes = await searchService.getIndexes();
    res.send(indexes);
  });

  app.get('/api/index/:name', auth, async (req, res, next) => {
    const { name } = req.params;
    logger.debug('GET physical index:', name);
    const index = await searchService.getIndex(name);
    if (!index) {
      return res.sendStatus(404);
    }
    res.send(index);
  });

  app.post('/api/index', auth, async (req, res, next) => {
    const { indexName, schema } = req.body;
    try {
      const searchSchema = searchService.getSearchSchema(schema);
      const resp = await searchService.createIndex(indexName, searchSchema);
      res.send(resp);
    } catch (err) {
      logger.error(String(err));
      res.sendStatus(400);
    }
  });

  app.delete('/api/index/:name', auth, async (req, res, next) => {
    const { name } = req.params;
    try {
      const resp = await searchService.dropIndex(name);
      res.send(resp);
    } catch (err) {
      logger.error(String(err));
      res.sendStatus(400);
    }
  });

  app.delete('/api/index/:name/data', auth, async (req, res, next) => {
    const { name } = req.params;
    try {
      const resp = await searchService.dropData(name);
      res.send(resp);
    } catch (err) {
      logger.error(String(err));
      res.sendStatus(400);
    }
  });

  app.post('/api/documents', auth, async (req, res, next) => {
    const { documents = [], indexName } = req.body;
    logger.debug('documents: ', JSON.stringify(documents, null, 2));
    logger.debug('indexName: ', indexName);
    const promises = documents.map((doc) => searchService.indexDocument(indexName, doc));
    await Promise.all(promises);
    res.send({ status: 'OK' });
  });

  app.delete('/api/indexes/:indexName/documents/:uid', async (req, res) => {
    const { indexName, uid } = req.params;
    try {
      await searchService.deleteDocument(indexName, uid);
      res.sendStatus(200);
    } catch (e) {
      logger.log('error', '%s\n%s', e, e.stack);
      res.status(500).json({
        error: { message: String(e) },
      });
    }
  });

  app.post('/api/bulk-delete', async (req, res) => {
    const { indexName, uids } = req.body;
    try {
      const resp = await searchService.deleteDocuments(indexName, uids);
      res.send(resp);
    } catch (err) {
      logger.error(String(err));
      res.sendStatus(400);
    }
  });

  app.delete('/api/delete-matching', async (req, res) => {
    const { indexName, q, ...rest } = req.query;
    try {
      await searchService.deleteDocumentsMatching(indexName, q, rest);
      res.sendStatus(200);
    } catch (e) {
      logger.log('error', '%s\n%s', e, e.stack);
      res.status(500).json({
        error: { message: String(e) },
      });
    }
  });

  app.post('/api/search', auth, async (req, res, next) => {
    const { requests, attrs } = req.body;
    const { indexName, params: { query } } = requests[0];
    const rawResults = await searchService.search(indexName, query, attrs);
    logger.log('debug', 'rawResults:', rawResults);
    const result = formatAlgolia(requests, rawResults);
    res.status(200).send({ results: [result] });
  });

  app.post('/api/sffv', auth, async (req, res, next) => {
    const { requests } = req.body;
    const results = [];
    res.status(200).send(results);
  });

  const formatAlgolia = (requests, rawResult) => {
    const documents = rawResult;
    const nbHits = documents.length;
    const hits = documents
      .map((val) => Object.entries(val).reduce((a, [k, v]) => {
        const key = k.match(/([^_]+_)?(.*)/)[2];
        a[key] = v;
        return a;
      }, {}))
      .map((val) => ({
        ...val,
        score: parseFloat(val.score),
      }))
      ;
    hits.sort((a, b) => a.score < b.score ? -1 : 1);
    return {
      exhaustive: {
        nbHits: true,
        typo: true,
      },
      exhaustiveNbHits: true,
      exhaustiveType: true,
      hits,
      hitsPerPage: nbHits,
      nbHits,
      nbPages: 1,
      page: 0,
      params: '',
      processingTimeMS: 2,
      processingTimingsMS: {
        afterFetch: {
          format: {
            highlighting: 2,
            total: 2,
          },
          total: 2,
        },
        request: {
          roundTrip: 19,
        },
        total: 2,
      },
      query: requests[0].params.query,
      renderingContent: {},
      serverTimeMS: 3,
    };
  };

};