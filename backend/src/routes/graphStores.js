export default ({ app, auth, logger, services }) => {

  const { graphStoreService } = services;

  app.get('/api/graph-stores', auth, (req, res) => {
    const providers = graphStoreService.getGraphStores();
    res.json(providers);
  });

  app.delete('/api/graph-stores/:provider', auth, (req, res) => {
    const { provider } = req.params;
    graphStoreService.dropData(provider);
    res.sendStatus(200);
  });

};