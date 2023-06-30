module.exports = ({ app, auth, logger, services }) => {

  const { piiService } = services;

  app.post('/api/pii', auth, async (req, res, next) => {
    const data = req.body;
    const resp = await piiService.scan2(data);
    res.json(resp);
  });

};