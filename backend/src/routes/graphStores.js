export default ({ app, auth, logger, services }) => {

  const { graphStoreService } = services;

  app.get('/api/graphs', auth, async (req, res) => {
    const { provider, index } = req.query;
    const graph = await graphStoreService.getGraph(provider, index);
    res.json(graph);
  });

  app.get('/api/graph-stores', auth, (req, res) => {
    const providers = graphStoreService.getGraphStores();
    res.json(providers);
  });

  app.delete('/api/graph-stores/:provider', auth, (req, res) => {
    const { provider } = req.params;
    const { indexName } = req.query;
    graphStoreService.dropData(provider, indexName);
    res.sendStatus(200);
  });

};
