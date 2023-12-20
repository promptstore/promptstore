import isEmpty from 'lodash.isempty';

import searchFunctions from '../searchFunctions';

export default ({ app, auth, constants, logger, services }) => {

  const OBJECT_TYPE = 'prompt-sets';

  const { executionsService, promptSetsService } = services;

  const { deleteObjects, deleteObject, indexObject } = searchFunctions({ constants, logger, services });

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
    const ps = await promptSetsService.upsertPromptSet(values, username);
    const obj = createSearchableObject(ps);
    await indexObject(obj);
    res.json(ps);
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
    const ps = await promptSetsService.upsertPromptSet({ ...values, id }, username);
    const obj = createSearchableObject(ps);
    await indexObject(obj);
    res.json(ps);
  });

  app.delete('/api/prompt-sets/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    await promptSetsService.deletePromptSets([id]);
    await deleteObject(objectId(id));
    res.json(id);
  });

  app.delete('/api/prompt-sets', auth, async (req, res, next) => {
    const ids = req.query.ids.split(',');
    await promptSetsService.deletePromptSets(ids);
    await deleteObjects(ids.map(objectId));
    res.json(ids);
  });

  const getSummaryLabel = async (workspaceId, username, prompts) => {
    logger.debug('get summary label');
    if (isEmpty(prompts)) return prompts;
    const content = prompts
      .map((m) => m.prompt)
      .join('\n\n')
      ;
    const args = { content };
    const { response, errors } = await executionsService.executeFunction({
      workspaceId,
      username,
      semanticFunctionName: 'create_summary_label',
      args,
      params: { maxTokens: 3 },
    });
    if (errors) {
      return null;
    }
    return response.choices[0].message.content;
  };

  const objectId = (id) => OBJECT_TYPE + ':' + id;

  function createSearchableObject(rec) {
    const texts = [
      rec.name,
      rec.tags?.join(' '),
      rec.description,
      rec.prompts?.map(p => p.prompt),
    ];
    const text = texts.filter(t => t).join('\n');
    return {
      id: objectId(rec.id),
      nodeLabel: 'Object',
      label: 'Prompt Template',
      type: OBJECT_TYPE,
      name: rec.name,
      key: rec.skill,
      text,
      createdDateTime: rec.created,
      createdBy: rec.createdBy,
      workspaceId: String(rec.workspaceId),
      isPublic: rec.isPublic,
      metadata: {
        tags: rec.tags,
        templateEngine: rec.templateEngine,
      },
    };
  }

};
