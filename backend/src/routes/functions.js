module.exports = ({ app, logger, passport, services }) => {

  const { functionsService } = services;

  app.get('/api/workspaces/:workspaceId/functions', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const { workspaceId } = req.params;
    const functions = await functionsService.getFunctions(workspaceId);
    res.json(functions);
  });

  app.get('/api/functions', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const functions = await functionsService.getFunctions();
    res.json(functions);
  });

  app.get('/api/functions/tags/:tag', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const tag = req.params.tag;
    const functions = await functionsService.getFunctionsByTag(tag);
    res.json(functions);
  });

  app.get('/api/functions/:id', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const id = req.params.id;
    const func = await functionsService.getFunction(id);
    res.json(func);
  });

  app.post('/api/functions', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const values = req.body;
    const id = await functionsService.upsertFunction(values);
    res.json(id);
  });

  app.put('/api/functions/:id', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const { id } = req.params;
    const values = req.body;
    await functionsService.upsertFunction({ id, ...values });
    res.json({ status: 'OK' });
  });

  app.delete('/api/functions/:id', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const id = req.params.id;
    await functionsService.deleteFunctions([id]);
    res.json(id);
  });

  app.delete('/api/functions', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const ids = req.query.ids.split(',');
    await functionsService.deleteFunctions(ids);
    res.json(ids);
  });

};
