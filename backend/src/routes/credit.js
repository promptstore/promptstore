export default ({ app, auth, constants, logger, services }) => {

  const { creditCalculatorService } = services;

  app.post('/api/credits', async (req, res, next) => {
    logger.debug('body:', req.body);
    const costComponents = creditCalculatorService.getCost(req.body);
    res.json(costComponents);
  });

}