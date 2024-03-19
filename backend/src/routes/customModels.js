export default ({ app, auth, constants, logger, services }) => {

  const {
    modelProviderService,
  } = services;


  app.get('/api/custom-model-providers', auth, (req, res, next) => {
    const providers = modelProviderService.getProviders();
    res.json(providers);
  });

};