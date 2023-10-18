export default ({ app, auth, logger, services }) => {

  const { embeddingService } = services;

  app.get('/api/embedding-providers', auth, (req, res) => {
    const providers = embeddingService.getEmbeddingProviders();
    res.json(providers);
  });

};