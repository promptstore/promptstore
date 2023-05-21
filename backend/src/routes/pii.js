module.exports = ({ app, passport, services }) => {

  const { piiService } = services;

  app.post('/api/pii', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const data = req.body;
    const resp = await piiService.scan2(data);
    res.json(resp);
  });

};