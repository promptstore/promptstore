module.exports = ({ app, auth, logger, services }) => {

  const { tracesService } = services;

  app.get('/api/traces', auth, async (req, res, next) => {
    const traces = await tracesService.getTraces();
    res.json(traces);
  });

  app.get('/api/traces/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    const trace = await tracesService.getTrace(id);
    logger.debug('trace:', trace);
    res.json(trace);
  });

  app.post('/api/traces', auth, async (req, res, next) => {
    const values = req.body;
    const id = await tracesService.upsertTrace(values);
    res.json(id);
  });

  app.put('/api/traces/:id', auth, async (req, res, next) => {
    const { id } = req.params;
    const values = req.body;
    await tracesService.upsertTrace({ id, ...values });
    res.json({ status: 'OK' });
  });

  app.delete('/api/traces/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    await tracesService.deleteTraces([id]);
    res.json(id);
  });

  app.delete('/api/traces', auth, async (req, res, next) => {
    const ids = req.query.ids.split(',');
    await tracesService.deleteTraces(ids);
    res.json(ids);
  });

};
