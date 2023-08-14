export default ({ app, auth, logger, services }) => {

  const { functionsService } = services;

  app.get('/api/workspaces/:workspaceId/functions', auth, async (req, res, next) => {
    const { workspaceId } = req.params;
    const functions = await functionsService.getFunctions(workspaceId);
    res.json(functions);
  });

  app.get('/api/workspaces/:workspaceId/functions/tags/:tag', auth, async (req, res, next) => {
    const { tag, workspaceId } = req.params;
    const functions = await functionsService.getFunctionsByTag(workspaceId, tag);
    res.json(functions);
  });

  app.get('/api/functions/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    const func = await functionsService.getFunction(id);
    res.json(func);
  });

  app.post('/api/functions', auth, async (req, res, next) => {
    const { username } = req.user;
    const values = req.body;
    const func = await functionsService.upsertFunction(values, username);
    res.json(func);
  });

  app.put('/api/functions/:id', auth, async (req, res, next) => {
    const { id } = req.params;
    const { username } = req.user;
    const values = req.body;
    const func = await functionsService.upsertFunction({ ...values, id }, username);
    res.json(func);
  });

  app.delete('/api/functions/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    await functionsService.deleteFunctions([id]);
    res.json(id);
  });

  app.delete('/api/functions', auth, async (req, res, next) => {
    const ids = req.query.ids.split(',');
    await functionsService.deleteFunctions(ids);
    res.json(ids);
  });

};
