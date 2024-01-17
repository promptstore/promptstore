import searchFunctions from '../searchFunctions';

export default ({ app, auth, constants, logger, services }) => {

  const OBJECT_TYPE = 'models';

  const { creditCalculatorService, modelsService } = services;

  const { deleteObjects, deleteObject, indexObject } = searchFunctions({ constants, logger, services });

  app.get('/api/workspace/:workspaceId/models', auth, async (req, res, next) => {
    const { workspaceId } = req.params;
    const { type } = req.query;
    let models;
    if (type) {
      models = await modelsService.getModelsByType(workspaceId, type);
    } else {
      models = await modelsService.getModels(workspaceId);
    }
    const creditsPerCall = creditCalculatorService.getCreditsPerCall();
    const ret = models.map(m => ({ ...m, creditsPerCall: creditsPerCall[m.key] }));
    res.json(ret);
  });

  app.get('/api/models/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    const model = await modelsService.getModel(id);
    const creditsPerCall = creditCalculatorService.getCreditsPerCall();
    res.json({ ...model, creditsPerCall: creditsPerCall[model.key] });
  });

  app.get('/api/workspace/:workspaceId/models-by-key/:key', auth, async (req, res, next) => {
    const { key, workspaceId } = req.params;
    const model = await modelsService.getModelByKey(workspaceId, key);
    res.json(model);
  });

  app.post('/api/models', auth, async (req, res, next) => {
    const { username } = req.user;
    const values = req.body;
    const model = await modelsService.upsertModel(values, username);
    const obj = createSearchableObject(model);
    await indexObject(obj);
    res.json(model);
  });

  app.put('/api/models/:id', auth, async (req, res, next) => {
    const { id } = req.params;
    const { username } = req.user;
    const values = req.body;
    const model = await modelsService.upsertModel({ id, ...values }, username);
    const obj = createSearchableObject(model);
    await indexObject(obj);
    res.json(model);
  });

  app.delete('/api/models/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    await modelsService.deleteModels([id]);
    await deleteObject(objectId(id));
    res.json(id);
  });

  app.delete('/api/models', auth, async (req, res, next) => {
    const ids = req.query.ids.split(',');
    await modelsService.deleteModels(ids);
    await deleteObjects(ids.map(objectId));
    res.json(ids);
  });

  const objectId = (id) => OBJECT_TYPE + ':' + id;

  function createSearchableObject(rec) {
    const texts = [
      rec.name,
      rec.description,
    ];
    const text = texts.filter(t => t).join('\n');
    return {
      id: objectId(rec.id),
      nodeLabel: 'Object',
      label: 'Model',
      type: OBJECT_TYPE,
      name: rec.name,
      key: rec.key,
      text,
      createdDateTime: rec.created,
      createdBy: rec.createdBy,
      workspaceId: String(rec.workspaceId),
      isPublic: rec.isPublic,
      metadata: {
        type: rec.type,
        provider: rec.provider,
      },
    };
  }

};
