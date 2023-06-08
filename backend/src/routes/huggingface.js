module.exports = ({ app, logger, passport, services }) => {

  const { huggingFaceService } = services;

  app.get('/api/huggingface/models', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const q = req.query.q;
    const models = await huggingFaceService.getModels(q);
    res.json(models);
  });

}