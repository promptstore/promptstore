import searchFunctions from '../searchFunctions';

export default ({ app, auth, constants, logger, services }) => {

  const OBJECT_TYPE = 'functions';

  const { functionsService } = services;

  const { deleteObjects, deleteObject, indexObject } = searchFunctions({ constants, logger, services });

  app.get('/api/workspaces/:workspaceId/functions', auth, async (req, res, next) => {
    const { workspaceId } = req.params;
    const functions = await functionsService.getFunctions(workspaceId);
    res.json(functions);
  });

  app.get('/api/workspaces/:workspaceId/functions/tags', auth, async (req, res, next) => {
    const { workspaceId } = req.params;
    const tags = req.query.tags.split(',').map(decodeURIComponent);
    const functions = await functionsService.getFunctionsByTags(workspaceId, tags);
    res.json(functions);
  });

  app.get('/api/workspaces/:workspaceId/functions/tags/:tag', auth, async (req, res, next) => {
    const { tag, workspaceId } = req.params;
    const functions = await functionsService.getFunctionsByTag(workspaceId, tag);
    res.json(functions);
  });

  app.get('/api/workspaces/:workspaceId/functions-by-promptset/:promptSetId', auth, async (req, res, next) => {
    const { promptSetId, workspaceId } = req.params;
    const functions = await functionsService.getFunctionsByPromptSet(workspaceId, promptSetId);
    res.json(functions);
  });

  app.get('/api/functions/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    const func = await functionsService.getFunction(id);
    res.json(func);
  });

  app.post('/api/functions', auth, async (req, res, next) => {
    const { username } = req.user;
    const values = req.body;
    const func = await functionsService.upsertFunction(values, username);
    const obj = createSearchableObject(func);
    await indexObject(obj);
    res.json(func);
  });

  app.put('/api/functions/:id', auth, async (req, res, next) => {
    const { id } = req.params;
    const { username } = req.user;
    const values = req.body;
    const func = await functionsService.upsertFunction({ ...values, id }, username);
    const obj = createSearchableObject(func);
    await indexObject(obj);
    res.json(func);
  });

  app.delete('/api/functions/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    await functionsService.deleteFunctions([id]);
    await deleteObject(objectId(id));
    res.json(id);
  });

  app.delete('/api/functions', auth, async (req, res, next) => {
    const ids = req.query.ids.split(',');
    await functionsService.deleteFunctions(ids);
    await deleteObjects(ids.map(objectId));
    res.json(ids);
  });

  const objectId = (id) => OBJECT_TYPE + ':' + id;

  function createSearchableObject(rec) {
    const texts = [
      rec.name,
      rec.tags?.join(' '),
      rec.description,
    ];
    const text = texts.filter(t => t).join('\n');
    return {
      id: objectId(rec.id),
      nodeLabel: 'Object',
      label: 'Semantic Function',
      type: OBJECT_TYPE,
      name: rec.name,
      text,
      createdDateTime: rec.created,
      createdBy: rec.createdBy,
      workspaceId: String(rec.workspaceId),
      isPublic: rec.isPublic,
      metadata: {
        documentType: rec.documentType,
        tags: rec.tags,
      },
    };
  }

};
