module.exports = ({ app, logger, passport, services }) => {

  const { trainingService } = services;

  app.get('/api/workspaces/:workspaceId/training', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const { workspaceId } = req.params;
    const { limit, start } = req.query;
    const data = await trainingService.getTrainingData(workspaceId, limit, start);
    res.json(data);
  });

  app.get('/api/training/:id', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const id = req.params.id;
    const row = await trainingService.getTrainingRow(id);
    res.json(row);
  });

  app.post('/api/training', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const values = req.body;
    const id = await trainingService.upsertTrainingRow(values);
    res.json(id);
  });

  app.put('/api/training/:id', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const { id } = req.params;
    const values = req.body;
    await trainingService.upsertTrainingRow({ id, ...values });
    res.json({ status: 'OK' });
  });

  app.delete('/api/training/:id', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const id = req.params.id;
    await trainingService.deleteTrainingRows([id]);
    res.json(id);
  });

  app.delete('/api/training', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const ids = req.query.ids.split(',');
    await trainingService.deleteTrainingRows(ids);
    res.json(ids);
  });

  app.delete('/api/content/:contentId/training', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const { contentId } = req.params;
    const ids = await trainingService.deleteTrainingRowByContentId(contentId);
    res.json(ids);
  });

};
