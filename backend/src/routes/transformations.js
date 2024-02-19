import startCase from 'lodash.startcase';
import camelCase from 'lodash.camelcase';

import { getDestinationSchema } from '../core/conversions/schema';
import searchFunctions from '../searchFunctions';
import { hasValue } from '../utils';
import { Indexer } from '../core/indexers/Indexer';

export default ({ app, auth, constants, logger, services, workflowClient }) => {

  const OBJECT_TYPE = 'transformations';

  const {
    functionsService,
    indexesService,
    llmService,
    modelsService,
    transformationsService,
    vectorStoreService,
  } = services;

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
    let values = req.body;
    const {
      indexName,
      name,
      vectorStoreProvider,
      workspaceId,
    } = values;
    const model = await modelsService.getModelByKey(workspaceId, values.embeddingModel);
    const embeddingModel = {
      provider: model.provider,
      model: model.key,
    };

    let indexId = values.indexId;
    // create index if new
    if (indexId === 'new') {
      const features = await getCleanedFeatures(values.features);
      const schema = getDestinationSchema(features);
      const indexer = new Indexer({
        indexesService,
        llmService,
        vectorStoreService,
      });
      const index = await indexer.createIndex({
        name: indexName,
        schema,
        workspaceId,
        username,
        embeddingModel,
        vectorStoreProvider,
        nodeLabel: startCase(camelCase(name)),
      });
      indexId = index.id;
    }
    values = {
      ...values,
      embeddingProvider: embeddingModel.provider,
      indexId,
    };
    let transformation = await transformationsService.upsertTransformation(values, username);
    if (hasValue(values.schedule)) {
      const scheduleId = await workflowClient.scheduleTransformation(transformation, workspaceId, username, {
        address: constants.TEMPORAL_URL,
      });
      values = {
        ...transformation,
        scheduleId,
        scheduleStatus: 'running',
      };
      transformation = await transformationsService.upsertTransformation(values, username);
    }
    const obj = createSearchableObject(transformation);
    await indexObject(obj);
    res.json(transformation);
  });

  app.put('/api/transformations/:id', auth, async (req, res, next) => {
    const { id } = req.params;
    const { username } = req.user;
    let transformation = transformationsService.getTransformation(id);
    let values = { ...transformation, ...req.body };
    const {
      name,
      indexName,
      vectorStoreProvider,
      workspaceId,
    } = values;
    const model = await modelsService.getModelByKey(workspaceId, values.embeddingModel);
    const embeddingModel = {
      provider: model.provider,
      model: model.key,
    };

    let indexId = values.indexId;
    // create index if new
    if (indexId === 'new') {
      const features = await getCleanedFeatures(values.features);
      const schema = getDestinationSchema(features);
      const indexer = new Indexer({
        indexesService,
        llmService,
        vectorStoreService,
      });
      const index = await indexer.createIndex({
        name: indexName,
        schema,
        workspaceId,
        username,
        embeddingModel,
        vectorStoreProvider,
        nodeLabel: startCase(camelCase(name)),
      });
      indexId = index.id;
    }

    if (values.scheduleStatus !== 'paused') {
      if (hasValue(values.schedule)) {
        logger.debug('scheduling transformation:', values);
        if (values.scheduleId) {
          await workflowClient.deleteSchedule(values.scheduleId, {
            address: constants.TEMPORAL_URL,
          });
        }
        const scheduleId = await workflowClient.scheduleTransformation(values, workspaceId, username, {
          address: constants.TEMPORAL_URL,
        });
        values = { ...values, id, scheduleId, scheduleStatus: 'running' };
      } else if (values.scheduleId) {
        await workflowClient.deleteSchedule(values.scheduleId, {
          address: constants.TEMPORAL_URL,
        });
        values = { ...values, id, scheduleId: null, scheduleStatus: null };
      }
    }

    transformation = await transformationsService.upsertTransformation(values, username);
    const obj = createSearchableObject(transformation);
    await indexObject(obj);
    res.json(transformation);
  });

  app.delete('/api/transformations/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    const tx = await transformationsService.getTransformation(id);
    if (tx.scheduleId) {
      await workflowClient.deleteSchedule(tx.scheduleId, {
        address: constants.TEMPORAL_URL,
      });
    }
    await transformationsService.deleteTransformations([id]);
    await deleteObject(objectId(id));
    res.json(id);
  });

  app.delete('/api/transformations', auth, async (req, res, next) => {
    const ids = req.query.ids.split(',');
    for (const id of ids) {
      const tx = await transformationsService.getTransformation(id);
      if (tx.scheduleId) {
        await workflowClient.deleteSchedule(tx.scheduleId, {
          address: constants.TEMPORAL_URL,
        });
      }
    }
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

  const getCleanedFeatures = async (features) => {
    const feats = [];
    for (const feature of features) {
      let featureName;
      if (feature.name) {
        featureName = feature.name;
      } else if (feature.functionId !== '__pass') {
        const func = await functionsService.getFunction(feature.functionId);
        featureName = func.name;
      } else if (feature.column !== '__all') {
        featureName = feature.column;
      }
      feats.push({ name: featureName, dataType: feature.type, mandatory: false });
    }
    return feats;
  };

};
