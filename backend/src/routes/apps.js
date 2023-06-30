module.exports = ({ app, auth, logger, services }) => {

  const { appsService } = services;

  app.get('/api/workspaces/:workspaceId/apps', auth, async (req, res, next) => {
    const { workspaceId } = req.params;
    const { limit, start } = req.query;
    const apps = await appsService.getApps(workspaceId, limit, start);
    res.json(apps);
  });

  app.get('/api/apps/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    const app = await appsService.getApp(id);
    res.json(app);
  });

  app.post('/api/apps', auth, async (req, res, next) => {
    const values = req.body;
    const id = await appsService.upsertApp(values);
    res.json(id);
  });

  app.put('/api/apps/:id', auth, async (req, res, next) => {
    const { id } = req.params;
    const values = req.body;
    await appsService.upsertApp({ id, ...values });
    res.json({ status: 'OK' });
  });

  app.delete('/api/apps/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    await appsService.deleteApps([id]);
    res.json(id);
  });

  app.delete('/api/apps', auth, async (req, res, next) => {
    const ids = req.query.ids.split(',');
    await appsService.deleteApps(ids);
    res.json(ids);
  });

};
