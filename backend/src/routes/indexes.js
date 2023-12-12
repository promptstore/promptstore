import searchFunctions from '../searchFunctions';

export default ({ app, auth, constants, logger, services }) => {

  const OBJECT_TYPE = 'indexes';

  const { graphStoreService, indexesService, vectorStoreService } = services;

  const { deleteObjects, deleteObject, indexObject } = searchFunctions({ constants, services });

  app.get('/api/workspaces/:workspaceId/indexes', auth, async (req, res, next) => {
    const { workspaceId } = req.params;
    const indexes = await indexesService.getIndexes(workspaceId);
    res.json(indexes);
  });

  app.get('/api/indexes/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    const index = await indexesService.getIndex(id);
    res.json(index);
  });

  app.post('/api/indexes', auth, async (req, res, next) => {
    const { username } = req.user;
    const values = req.body;
    const index = await indexesService.upsertIndex(values, username);
    const obj = createSearchableObject(index);
    await indexObject(obj);
    res.json(index);
  });

  app.put('/api/indexes/:id', auth, async (req, res, next) => {
    const { id } = req.params;
    const { username } = req.user;
    const values = req.body;
    const index = await indexesService.upsertIndex({ ...values, id }, username);
    const obj = createSearchableObject(index);
    await indexObject(obj);
    res.json(index);
  });

  app.delete('/api/indexes/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    await deletePhysicalIndexAndData(id);
    await indexesService.deleteIndexes([id]);
    await deleteObject(objectId(id));
    res.json(id);
  });

  app.delete('/api/indexes', auth, async (req, res, next) => {
    const ids = req.query.ids.split(',');
    const proms = ids.map(deletePhysicalIndexAndData);
    await Promise.all(proms);
    await indexesService.deleteIndexes(ids);
    await deleteObjects(ids.map(objectId));
    res.json(ids);
  });

  async function deletePhysicalIndexAndData(indexId) {
    const { name, nodeLabel, vectorStoreProvider, graphStoreProvider } = await indexesService.getIndex(indexId);
    if (vectorStoreProvider) {
      try {
        await vectorStoreService.dropData(vectorStoreProvider, name, { nodeLabel });
        await vectorStoreService.dropIndex(vectorStoreProvider, name);
      } catch (err) {
        logger.error(`Error dropping index %s:%s:`, vectorStoreProvider, name, err);
        // maybe no such index
      }
    } else if (graphStoreProvider) {
      try {
        await graphStoreService.dropData(graphStoreProvider);
      } catch (err) {
        logger.error(`Error dropping data from %s:%s:`, graphStoreProvider, name, err);
        // maybe no such store
      }
    }
  }

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
      label: 'Semantic Index',
      type: OBJECT_TYPE,
      name: rec.name,
      text,
      createdDateTime: rec.created,
      createdBy: rec.createdBy,
      workspaceId: String(rec.workspaceId),
      metadata: {
        vectorStoreProvider: rec.vectorStoreProvider,
        graphStoreProvider: rec.graphStoreProvider,
      },
    };
  }

};
