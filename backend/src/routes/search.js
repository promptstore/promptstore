module.exports = ({ app, logger, passport, services }) => {

  const { searchService } = services;

  app.post('/api/workspaces/:workspaceId/index', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
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

  app.post('/api/search', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const { requests } = req.body;
    const { indexName, params: { query } } = requests[0];
    const rawResults = await searchService.search(indexName, query);
    const result = formatAlgolia(requests, rawResults);
    res.status(200).send({ results: [result] });
  });

  app.post('/api/sffv', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
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
        uid: val.__uid,
        label: val._label,
        value: val.text || val.value,
      }));
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