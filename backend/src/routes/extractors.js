export default ({ app, auth, constants, logger, services }) => {

  const {
    extractorService,
  } = services;


  app.get('/api/extractors', auth, (req, res, next) => {
    const extractors = extractorService.getExtractors();
    res.json(extractors);
  });

};