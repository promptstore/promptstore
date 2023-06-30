module.exports = ({ app, auth, logger, services }) => {

  const { modelsService } = services;

  app.get('/api/models', auth, async (req, res, next) => {
    const models = await modelsService.getModels();
    res.json(models);
  });

  app.get('/api/models/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    const model = await modelsService.getModel(id);
    res.json(model);
  });

  app.post('/api/models', auth, async (req, res, next) => {
    const values = req.body;
    const id = await modelsService.upsertModel(values);
    res.json(id);
  });

  app.put('/api/models/:id', auth, async (req, res, next) => {
    const { id } = req.params;
    const values = req.body;
    await modelsService.upsertModel({ id, ...values });
    res.json({ status: 'OK' });
  });

  app.delete('/api/models/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    await modelsService.deleteModels([id]);
    res.json(id);
  });

  app.delete('/api/models', auth, async (req, res, next) => {
    const ids = req.query.ids.split(',');
    await modelsService.deleteModels(ids);
    res.json(ids);
  });

};
