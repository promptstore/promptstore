module.exports = ({ app, logger, passport, services }) => {

  const { promptSetsService } = services;

  app.get('/api/prompt-sets', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const sets = await promptSetsService.getPromptSets();
    res.json(sets);
  });

  app.get('/api/workspaces/:workspaceId/prompt-sets', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const { workspaceId } = req.params;
    const { skill } = req.query;
    let promptSets;
    if (skill) {
      promptSets = await promptSetsService.getPromptSetBySkill(skill);
    } else {
      promptSets = await promptSetsService.getPromptSets(workspaceId);
    }
    res.json(promptSets);
  });

  app.get('/api/prompt-set-templates', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const sets = await promptSetsService.getPromptSetTemplates();
    res.json(sets);
  });

  app.get('/api/prompt-sets/:id', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const id = req.params.id;
    const promptSet = await promptSetsService.getPromptSet(id);
    res.json(promptSet);
  });

  app.post('/api/prompt-sets', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const values = req.body;
    const id = await promptSetsService.upsertPromptSet(values);
    res.json(id);
  });

  app.put('/api/prompt-sets/:id', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const { id } = req.params;
    const values = req.body;
    await promptSetsService.upsertPromptSet({ id, ...values });
    res.json({ status: 'OK' });
  });

  app.delete('/api/prompt-sets/:id', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const id = req.params.id;
    await promptSetsService.deletePromptSets([id]);
    res.json(id);
  });

  app.delete('/api/prompt-sets', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const ids = req.query.ids.split(',');
    await promptSetsService.deletePromptSets(ids);
    res.json(ids);
  });

};
