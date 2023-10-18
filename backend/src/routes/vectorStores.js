export default ({ app, auth, logger, services }) => {

  const { vectorStoreService } = services;

  app.get('/api/vector-stores', auth, (req, res) => {
    const providers = vectorStoreService.getVectorStores();
    res.json(providers);
  });

};