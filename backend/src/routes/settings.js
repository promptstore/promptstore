module.exports = ({ app, logger, passport, services }) => {

  const { settingsService } = services;

  app.get('/api/workspaces/:workspaceId/settings/:key', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const { workspaceId, key } = req.params;
    const setting = await settingsService.getSettingByKey(workspaceId, key);
    res.json(setting);
  });

  app.post('/api/settings', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const values = req.body;
    const id = await settingsService.upsertSetting(values);
    res.json(id);
  });

  app.put('/api/settings/:id', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const { id } = req.params;
    const values = req.body;
    await settingsService.upsertSetting({ id, ...values });
    res.json({ status: 'OK' });
  });

  app.delete('/api/settings/:id', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const id = req.params.id;
    await settingsService.deleteSettings([id]);
    res.json(id);
  });

  app.delete('/api/settings', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const ids = req.query.ids.split(',');
    await settingsService.deleteSettings(ids);
    res.json(ids);
  });

};
