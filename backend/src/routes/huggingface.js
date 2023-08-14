export default ({ app, auth, logger, services }) => {

  const { modelProviderService } = services;

  app.get('/api/huggingface/models', auth, async (req, res, next) => {
    const q = req.query.q;
    const models = await modelProviderService.getModels('huggingface', q);
    res.json(models);
  });

}