import { columnsToFields } from '../core/conversions/schema';
import searchFunctions from '../searchFunctions';

export default ({ app, auth, constants, logger, services, workflowClient }) => {

  const OBJECT_TYPE = 'transformations';

  const { dataSourcesService, sqlSourceService, transformationsService } = services;

  const { deleteObjects, deleteObject, indexObject } = searchFunctions({ constants, logger, services });

  // cache of results to poll
  const jobs = {};

  app.get('/api/transformation-status/:correlationId', auth, async (req, res) => {
    const { correlationId } = req.params;
    // logger.debug('checking transformation status for:', correlationId);
    const result = jobs[correlationId];
    if (!result) {
      return res.sendStatus(423);
    }
    res.json(result);
    delete jobs[correlationId];
  });

  app.get('/api/workspaces/:workspaceId/transformations', auth, async (req, res, next) => {
    const { workspaceId } = req.params;
    const transformations = await transformationsService.getTransformations(workspaceId);
    res.json(transformations);
  });

  app.get('/api/transformations/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    const transformation = await transformationsService.getTransformation(id);
    // logger.debug('transformation:', transformation);
    res.json(transformation);
  });

  app.post('/api/transformations', auth, async (req, res, next) => {
    const { username } = req.user;
    const values = req.body;
    const { dataSourceId, features, indexId, indexName, workspaceId, vectorStoreProvider } = values;

    // create index if new
    if (indexId === 'new') {
      // const source = await dataSourcesService.getDataSource(dataSourceId);
      // if (source.type === 'sql') {
      //   const meta = await sqlSourceService.getSchema(source);
      //   const schema = meta[source.tableName];
      //   const indexFields = columnsToFields(schema.columns);
      //   const index = await indexesService.upsertIndex({
      //     name: indexName,
      //     schema: { content: indexFields },
      //     workspaceId,
      //     vectorStoreProvider,
      //   });
      // }
      const indexFields = Object.values(features).reduce((a, f) => {
        a[f.name] = {
          name: f.name,
          dataType: f.dataType,
          mandatory: false,
        };
        return a;
      }, {});
      const index = await indexesService.upsertIndex({
        name: indexName,
        schema: { content: indexFields },
        workspaceId,
        vectorStoreProvider,
      });
    }

    const transformation = await transformationsService.upsertTransformation(values, username);
    const obj = createSearchableObject(transformation);
    await indexObject(obj);
    res.json(transformation);
  });

  app.put('/api/transformations/:id', auth, async (req, res, next) => {
    const { id } = req.params;
    const { username } = req.user;
    const values = req.body;
    const transformation = await transformationsService.upsertTransformation({ ...values, id }, username);
    const obj = createSearchableObject(transformation);
    await indexObject(obj);
    res.json(transformation);
  });

  app.delete('/api/transformations/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    await transformationsService.deleteTransformations([id]);
    await deleteObject(objectId(id));
    res.json(id);
  });

  app.delete('/api/transformations', auth, async (req, res, next) => {
    const ids = req.query.ids.split(',');
    await transformationsService.deleteTransformations(ids);
    await deleteObjects(ids.map(objectId));
    res.json(ids);
  });

  app.post('/api/transformation-runs/:id', auth, async (req, res, next) => {
    const { username } = req.user;
    const { correlationId, workspaceId } = req.body;
    const tx = await transformationsService.getTransformation(req.params.id);
    workflowClient
      .transform(tx, workspaceId, username, {
        address: constants.TEMPORAL_URL,
      })
      .then((result) => {
        // logger.debug('result:', result);
        if (correlationId) {
          jobs[correlationId] = result;
        }

        // allow 10m to poll for results
        setTimeout(() => {
          delete jobs[correlationId];
        }, 10 * 60 * 1000);

      });
    res.sendStatus(200);
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
      label: 'Transformation',
      type: OBJECT_TYPE,
      name: rec.name,
      text,
      createdDateTime: rec.created,
      createdBy: rec.createdBy,
      workspaceId: String(rec.workspaceId),
      metadata: {
        dataSourceId: rec.dataSourceId,
        destinationIds: rec.destinationIds,
        indexId: rec.indexId,
        vectorStoreProvider: rec.engine,
      },
    };
  }

};
