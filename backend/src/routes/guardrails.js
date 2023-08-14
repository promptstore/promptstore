export default ({ app, auth, logger, services }) => {

  const { guardrailsService } = services;

  app.get('/api/guardrails', auth, async (req, res, next) => {
    const guardrails = guardrailsService.getGuardrails();
    res.json(guardrails);
  });

}