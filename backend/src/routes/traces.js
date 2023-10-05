export default ({ app, auth, logger, services }) => {

  const { tracesService } = services;

  app.get('/api/workspaces/:workspaceId/traces', auth, async (req, res, next) => {
    const { workspaceId } = req.params;
    const traces = await tracesService.getTraces(workspaceId);
    res.json(traces);
  });

  app.get('/api/traces/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    const trace = await tracesService.getTrace(id);
    // logger.debug('trace:', trace);
    res.json(trace);
  });

  app.post('/api/traces', auth, async (req, res, next) => {
    const { username } = req.user;
    const values = req.body;
    const trace = await tracesService.upsertTrace(values, username);
    res.json(trace);
  });

  app.put('/api/traces/:id', auth, async (req, res, next) => {
    const { id } = req.params;
    const { username } = req.user;
    const values = req.body;
    const trace = await tracesService.upsertTrace({ ...values, id }, username);
    res.json(trace);
  });

  app.delete('/api/traces/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    await tracesService.deleteTraces([id]);
    res.json(id);
  });

  app.delete('/api/traces', auth, async (req, res, next) => {
    const ids = req.query.ids.split(',').map(id => +id);
    await tracesService.deleteTraces(ids);
    res.json(ids);
  });

};
