export default ({ app, auth, logger, services }) => {

  const { llmService } = services;

  app.get('/api/embedding-providers', auth, (req, res) => {
    const providers = llmService.getEmbeddingProviders();
    res.json(providers);
  });

};