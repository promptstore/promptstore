export default ({ app, auth, logger, services }) => {

  const { secretsService } = services;

  app.get('/api/workspaces/:workspaceId/secrets', auth, async (req, res) => {
    const { workspaceId } = req.params;
    const secrets = await secretsService.getSecrets(workspaceId);
    res.json(secrets);
  });

  app.get('/api/secrets/:id', auth, async (req, res) => {
    const { id } = req.params;
    const secret = await secretsService.getSecret(id);
    res.json(secret);
  });

  app.get('/api/workspaces/:workspaceId/secrets-by-name/:name', auth, async (req, res) => {
    const { name, workspaceId } = req.params;
    const secret = await secretsService.getSecretByName(workspaceId, decodeURIComponent(name));
    res.json(secret);
  });

  app.post('/api/secrets', auth, async (req, res) => {
    const { username } = req.user;
    const values = req.body;
    const secret = await secretsService.upsertSecret(values, username);
    res.json(secret);
  });

  app.put('/api/secrets/:id', auth, async (req, res) => {
    const { username } = req.user;
    const { id } = req.params;
    const values = req.body;
    const secret = await secretsService.upsertSecret({ id, ...values }, username);
    res.json(secret);
  });

  app.delete('/api/secrets/:id', auth, async (req, res) => {
    const id = req.params.id;
    await secretsService.deleteSecrets([id]);
    res.json(id);
  });

  app.delete('/api/secrets', auth, async (req, res) => {
    const ids = req.query.ids.split(',');
    await secretsService.deleteSecrets(ids);
    res.json(ids);
  });

};
