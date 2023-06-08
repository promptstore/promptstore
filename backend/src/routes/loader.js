module.exports = ({ app, logger, passport, services }) => {

  const { loaderService } = services;

  app.post('/api/loader', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const { filepath, params } = req.body;
    await loaderService.load(filepath, params);
    res.json({ status: 'OK' });
  });

};
