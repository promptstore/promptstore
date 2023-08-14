import isEmpty from 'lodash.isempty';

export default ({ app, auth, logger, services }) => {

  const { executionsService, functionsService, promptSetsService } = services;

  app.get('/api/workspaces/:workspaceId/prompt-sets', auth, async (req, res, next) => {
    const { workspaceId } = req.params;
    const { skill } = req.query;
    let promptSets;
    if (skill) {
      promptSets = await promptSetsService.getPromptSetsBySkill(workspaceId, skill);
    } else {
      promptSets = await promptSetsService.getPromptSets(workspaceId);
    }
    res.json(promptSets);
  });

  app.get('/api/workspaces/:workspaceId/prompt-set-templates', auth, async (req, res, next) => {
    const { workspaceId } = req.params;
    const sets = await promptSetsService.getPromptSetTemplates(workspaceId);
    res.json(sets);
  });

  app.get('/api/prompt-sets/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    const promptSet = await promptSetsService.getPromptSet(id);
    res.json(promptSet);
  });

  app.post('/api/prompt-sets', auth, async (req, res, next) => {
    const { username } = req.user;
    const values = req.body;
    try {
      values.summary = await getSummaryLabel(values.workspaceId, username, values.prompts);
    } catch (err) {
      logger.warn(err);
      // proceed without summary
    }
    const promptSet = await promptSetsService.upsertPromptSet(values, username);
    res.json(promptSet);
  });

  app.put('/api/prompt-sets/:id', auth, async (req, res, next) => {
    const { id } = req.params;
    const { username } = req.user;
    const values = req.body;
    try {
      values.summary = await getSummaryLabel(values.workspaceId, username, values.prompts);
    } catch (err) {
      logger.warn(err);
      // proceed without summary
    }
    const promptSet = await promptSetsService.upsertPromptSet({ ...values, id }, username);
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

  const getSummaryLabel = async (workspaceId, username, prompts) => {
    logger.debug('getSummaryLabel');
    if (isEmpty(prompts)) return prompts;
    const content = prompts
      .map((m) => m.prompt)
      .join('\n\n')
      ;
    const args = { content };
    const resp = await executionsService.executeFunction({
      workspaceId,
      username,
      semanticFunctionName: 'create_summary_label',
      args,
      params: { maxTokens: 3 },
    });
    logger.log('debug', 'resp:', resp);
    return resp.data.content;
  };

};
