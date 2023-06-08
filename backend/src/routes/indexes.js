module.exports = ({ app, logger, passport, services }) => {

  const { indexesService } = services;

  app.get('/api/indexes', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const indexes = await indexesService.getIndexes();
    res.json(indexes);
  });

  app.get('/api/indexes/:id', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const id = req.params.id;
    const index = await indexesService.getIndex(id);
    res.json(index);
  });

  app.post('/api/indexes', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const values = req.body;
    const id = await indexesService.upsertIndex(values);
    res.json(id);
  });

  app.put('/api/indexes/:id', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const { id } = req.params;
    const values = req.body;
    await indexesService.upsertIndex({ id, ...values });
    res.json({ status: 'OK' });
  });

  app.delete('/api/indexes/:id', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const id = req.params.id;
    await indexesService.deleteIndexes([id]);
    res.json(id);
  });

  app.delete('/api/indexes', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const ids = req.query.ids.split(',');
    await indexesService.deleteIndexes(ids);
    res.json(ids);
  });

};
