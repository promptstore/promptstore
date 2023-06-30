module.exports = ({ app, auth, logger, services }) => {

  const { huggingFaceService } = services;

  app.get('/api/huggingface/models', auth, async (req, res, next) => {
    const q = req.query.q;
    const models = await huggingFaceService.getModels(q);
    res.json(models);
  });

}