import searchFunctions from '../searchFunctions';

export default ({ app, auth, constants, logger, services }) => {
  const OBJECT_TYPE = 'functions';

  const { functionsService, workspacesService } = services;

  const { deleteObjects, deleteObject, indexObject } = searchFunctions({ constants, logger, services });

  app.get('/api/workspaces/:workspaceId/functions', auth, async (req, res, next) => {
    const { workspaceId } = req.params;
    const { roles, username } = req.user;
    if (!roles.includes('admin')) {
      const workspace = await workspacesService.getWorkspace(workspaceId);
      if (!workspace.members?.find(m => m.username === username)) {
        return res.status(403).json({ error: 'You are not a member of this workspace' });
      }
    }
    const functions = await functionsService.getFunctions(workspaceId);
    res.json(functions);
  });

  app.get('/api/workspaces/:workspaceId/functions/tags', auth, async (req, res, next) => {
    const { workspaceId } = req.params;
    const { roles, username } = req.user;
    if (!roles.includes('admin')) {
      const workspace = await workspacesService.getWorkspace(workspaceId);
      if (!workspace.members?.find(m => m.username === username)) {
        return res.status(403).json({ error: 'You are not a member of this workspace' });
      }
    }
    const tags = req.query.tags.split(',').map(decodeURIComponent);
    const functions = await functionsService.getFunctionsByTags(workspaceId, tags);
    res.json(functions);
  });

  app.get('/api/workspaces/:workspaceId/functions/tags/:tag', auth, async (req, res, next) => {
    const { tag, workspaceId } = req.params;
    const { roles, username } = req.user;
    if (!roles.includes('admin')) {
      const workspace = await workspacesService.getWorkspace(workspaceId);
      if (!workspace.members?.find(m => m.username === username)) {
        return res.status(403).json({ error: 'You are not a member of this workspace' });
      }
    }
    const functions = await functionsService.getFunctionsByTag(workspaceId, tag);
    res.json(functions);
  });

  app.get(
    '/api/workspaces/:workspaceId/functions-by-promptset/:promptSetId',
    auth,
    async (req, res, next) => {
      const { promptSetId, workspaceId } = req.params;
      const { roles, username } = req.user;
      if (!roles.includes('admin')) {
        const workspace = await workspacesService.getWorkspace(workspaceId);
        if (!workspace.members?.find(m => m.username === username)) {
          return res.status(403).json({ error: 'You are not a member of this workspace' });
        }
      }
      const functions = await functionsService.getFunctionsByPromptSet(workspaceId, promptSetId);
      res.json(functions);
    }
  );

  app.get('/api/workspaces/:workspaceId/functions/:id', auth, async (req, res, next) => {
    const { id, workspaceId } = req.params;
    const { roles, username } = req.user;
    if (!roles.includes('admin')) {
      const workspace = await workspacesService.getWorkspace(workspaceId);
      if (!workspace.members?.find(m => m.username === username)) {
        return res.status(403).json({ error: 'You are not a member of this workspace' });
      }
    }
    const func = await functionsService.getFunction(id);
    res.json(func);
  });

  app.post('/api/functions', auth, async (req, res, next) => {
    const { roles, username } = req.user;
    const values = req.body;
    if (!roles.includes('admin')) {
      const workspace = await workspacesService.getWorkspace(values.workspaceId);
      if (!workspace.members?.find(m => m.username === username)) {
        return res.status(403).json({ error: 'You are not a member of this workspace' });
      }
    }
    let func = await functionsService.upsertFunction(values, username);
    if (!constants.MINIMAL_INSTALL) {
      const obj = createSearchableObject(func);
      const chunkId = await indexObject(obj, func.chunkId);
      if (!func.chunkId) {
        func = await functionsService.upsertFunction({ ...func, chunkId }, username);
      }
    }
    res.json(func);
  });

  app.put('/api/functions/:id', auth, async (req, res, next) => {
    const { id } = req.params;
    const { roles, username } = req.user;
    const values = req.body;
    if (!roles.includes('admin')) {
      const func = await functionsService.getFunction(id);
      const workspace = await workspacesService.getWorkspace(func.workspaceId);
      if (!workspace.members?.find(m => m.username === username)) {
        return res.status(403).json({ error: 'You are not a member of this workspace' });
      }
    }
    let func = await functionsService.upsertFunction({ ...values, id }, username);
    if (!constants.MINIMAL_INSTALL) {
      const obj = createSearchableObject(func);
      const chunkId = await indexObject(obj, func.chunkId);
      if (!func.chunkId) {
        func = await functionsService.upsertFunction({ ...func, chunkId }, username);
      }
    }
    res.json(func);
  });

  app.delete('/api/functions/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    const { roles, username } = req.user;
    if (!roles.includes('admin')) {
      const func = await functionsService.getFunction(id);
      const workspace = await workspacesService.getWorkspace(func.workspaceId);
      if (!workspace.members?.find(m => m.username === username)) {
        return res.status(403).json({ error: 'You are not a member of this workspace' });
      }
    }
    await functionsService.deleteFunctions([id]);
    if (!constants.MINIMAL_INSTALL) {
      await deleteObject(objectId(id));
    }
    res.json(id);
  });

  app.delete('/api/functions', auth, async (req, res, next) => {
    const ids = req.query.ids.split(',');
    const { roles, username } = req.user;
    if (!roles.includes('admin')) {
      for (const id of ids) {
        const func = await functionsService.getFunction(id);
        const workspace = await workspacesService.getWorkspace(func.workspaceId);
        if (!workspace.members?.find(m => m.username === username)) {
          return res.status(403).json({ error: 'You are not a member of this workspace' });
        }
      }
    }
    await functionsService.deleteFunctions(ids);
    if (!constants.MINIMAL_INSTALL) {
      await deleteObjects(ids.map(objectId));
    }
    res.json(ids);
  });

  const objectId = id => OBJECT_TYPE + ':' + id;

  function createSearchableObject(rec) {
    const texts = [rec.name, rec.tags?.join(' '), rec.description];
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
