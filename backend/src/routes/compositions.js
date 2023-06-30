module.exports = ({ app, auth, logger, services }) => {

  const { compositionsService } = services;

  app.get('/api/workspaces/:workspaceId/compositions', auth, async (req, res, next) => {
    const { workspaceId } = req.params;
    const compositions = await compositionsService.getCompositions(workspaceId);
    res.json(compositions);
  });

  app.get('/api/compositions', auth, async (req, res, next) => {
    const compositions = await compositionsService.getCompositions();
    res.json(compositions);
  });

  app.get('/api/compositions/tags/:tag', auth, async (req, res, next) => {
    const tag = req.params.tag;
    const compositions = await compositionsService.getCompositionsByTag(tag);
    res.json(compositions);
  });

  app.get('/api/compositions/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    const func = await compositionsService.getComposition(id);
    res.json(func);
  });

  app.post('/api/compositions', auth, async (req, res, next) => {
    const values = req.body;
    const id = await compositionsService.upsertComposition(values);
    res.json(id);
  });

  app.put('/api/compositions/:id', auth, async (req, res, next) => {
    const { id } = req.params;
    const values = req.body;
    await compositionsService.upsertComposition({ id, ...values });
    res.json({ status: 'OK' });
  });

  app.delete('/api/compositions/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    await compositionsService.deleteCompositions([id]);
    res.json(id);
  });

  app.delete('/api/compositions', auth, async (req, res, next) => {
    const ids = req.query.ids.split(',');
    await compositionsService.deleteCompositions(ids);
    res.json(ids);
  });

};
