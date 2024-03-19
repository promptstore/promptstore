export default ({ app, auth, constants, logger, services }) => {

  const {
    loaderService,
  } = services;


  app.get('/api/loaders', auth, (req, res, next) => {
    const loaders = loaderService.getLoaders();
    res.json(loaders);
  });

};