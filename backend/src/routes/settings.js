export default ({ app, auth, logger, services }) => {

  const { settingsService } = services;

  app.get('/api/workspaces/:workspaceId/settings/:key', auth, async (req, res, next) => {
    const { workspaceId, key } = req.params;
    logger.debug('key:', key);
    const settings = await settingsService.getSettingsByKey(workspaceId, key);
    res.json(settings);
  });

  app.post('/api/settings', auth, async (req, res, next) => {
    const { username } = req.user;
    const values = req.body;
    const id = await settingsService.upsertSetting(values, username);
    res.json(id);
  });

  app.put('/api/settings/:id', auth, async (req, res, next) => {
    const { id } = req.params;
    const { username } = req.user;
    const values = req.body;
    await settingsService.upsertSetting({ id, ...values }, username);
    res.json({ status: 'OK' });
  });

  app.delete('/api/settings/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    await settingsService.deleteSettings([id]);
    res.json(id);
  });

  app.delete('/api/settings', auth, async (req, res, next) => {
    const ids = req.query.ids.split(',');
    await settingsService.deleteSettings(ids);
    res.json(ids);
  });

};
