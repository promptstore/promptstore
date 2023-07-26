const isEmpty = require('lodash.isempty');

module.exports = ({ app, auth, logger, services }) => {

  const { executionsService, functionsService, promptSetsService } = services;

  app.get('/api/prompt-sets', auth, async (req, res, next) => {
    const sets = await promptSetsService.getPromptSets();
    res.json(sets);
  });

  app.get('/api/workspaces/:workspaceId/prompt-sets', auth, async (req, res, next) => {
    const { workspaceId } = req.params;
    const { skill } = req.query;
    let promptSets;
    if (skill) {
      promptSets = await promptSetsService.getPromptSetsBySkill(skill);
    } else {
      promptSets = await promptSetsService.getPromptSets(workspaceId);
    }
    res.json(promptSets);
  });

  app.get('/api/prompt-set-templates', auth, async (req, res, next) => {
    const sets = await promptSetsService.getPromptSetTemplates();
    res.json(sets);
  });

  app.get('/api/prompt-sets/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    const promptSet = await promptSetsService.getPromptSet(id);
    res.json(promptSet);
  });

  app.post('/api/prompt-sets', auth, async (req, res, next) => {
    const values = req.body;
    try {
      values.summary = await getSummaryLabel(values.prompts);
    } catch (err) {
      logger.warn(err);
      // proceed without summary
    }
    const id = await promptSetsService.upsertPromptSet(values);
    res.json(id);
  });

  app.put('/api/prompt-sets/:id', auth, async (req, res, next) => {
    const { id } = req.params;
    const values = req.body;
    try {
      values.summary = await getSummaryLabel(values.prompts);
    } catch (err) {
      logger.warn(err);
      // proceed without summary
    }
    const promptSet = await promptSetsService.upsertPromptSet({ id, ...values });
    res.json(promptSet);
  });

  app.delete('/api/prompt-sets/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    await promptSetsService.deletePromptSets([id]);
    res.json(id);
  });

  app.delete('/api/prompt-sets', auth, async (req, res, next) => {
    const ids = req.query.ids.split(',');
    await promptSetsService.deletePromptSets(ids);
    res.json(ids);
  });

  const getSummaryLabel = async (prompts) => {
    if (isEmpty(prompts)) return prompts;
    const func = await functionsService.getFunctionByName('create_summary_label');
    if (!func) {
      throw new Error('Function not found');
    }
    const content = prompts
      .map((m) => m.prompt)
      .join('\n\n');
    const args = { content };
    const resp = await executionsService.executeFunction(func, args, { maxTokens: 3 });
    // logger.log('debug', 'resp: %s', resp);
    return resp.data.content;
  };

};
