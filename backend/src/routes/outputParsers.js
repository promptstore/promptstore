export default ({ app, auth, logger, services }) => {

  const { parserService } = services;

  app.get('/api/output-parsers', auth, async (req, res, next) => {
    const parsers = parserService.getOutputParsers();
    res.json(parsers);
  });

}