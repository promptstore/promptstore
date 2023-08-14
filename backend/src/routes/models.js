export default ({ app, auth, logger, services }) => {

  const { modelsService } = services;

  app.get('/api/workspace/:workspaceId/models', auth, async (req, res, next) => {
    const { workspaceId } = req.params;
    const models = await modelsService.getModels(workspaceId);
    res.json(models);
  });

  app.get('/api/models/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    const model = await modelsService.getModel(id);
    res.json(model);
  });

  app.post('/api/models', auth, async (req, res, next) => {
    const { username } = req.user;
    const values = req.body;
    const model = await modelsService.upsertModel(values, username);
    res.json(model);
  });

  app.put('/api/models/:id', auth, async (req, res, next) => {
    const { id } = req.params;
    const { username } = req.user;
    const values = req.body;
    const model = await modelsService.upsertModel({ id, ...values }, username);
    res.json(model);
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
