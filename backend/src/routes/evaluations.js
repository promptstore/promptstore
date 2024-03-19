import searchFunctions from '../searchFunctions';
import { hasValue } from '../utils';

export default ({ app, auth, constants, logger, services, workflowClient }) => {

  const OBJECT_TYPE = 'evaluations';

  const { evaluationsService } = services;

  const { deleteObjects, deleteObject, indexObject } = searchFunctions({ constants, logger, services });

  // cache of results to poll
  const jobs = {};

  app.get('/api/evaluation-status/:correlationId', auth, async (req, res) => {
    const { correlationId } = req.params;
    // logger.debug('checking evaluation status for:', correlationId);
    const result = jobs[correlationId];
    if (!result) {
      return res.sendStatus(423);
    }
    res.json(result);
    delete jobs[correlationId];
  });

  app.get('/api/workspaces/:workspaceId/evaluations', auth, async (req, res, next) => {
    const { workspaceId } = req.params;
    const evaluations = await evaluationsService.getEvaluations(workspaceId);
    res.json(evaluations);
  });

  app.get('/api/workspaces/:workspaceId/evaluation-runs', auth, async (req, res, next) => {
    const { workspaceId } = req.params;
    const runs = await evaluationsService.getEvalRuns(workspaceId);
    res.json(runs);
  });

  app.get('/api/evaluations/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    const evaluation = await evaluationsService.getEvaluation(id);
    res.json(evaluation);
  });

  app.post('/api/evaluations', auth, async (req, res, next) => {
    const { username } = req.user;
    let values = req.body;
    let evaluation = await evaluationsService.upsertEvaluation(values, username);
    if (hasValue(values.schedule)) {
      const scheduleId = await workflowClient.scheduleEvaluation(evaluation, values.workspaceId, username, {
        address: constants.TEMPORAL_URL,
      });
      values = {
        ...evaluation,
        scheduleId,
        scheduleStatus: 'running',
      };
      evaluation = await evaluationsService.upsertEvaluation(values, username);
    }
    const obj = createSearchableObject(evaluation);
    const chunkId = await indexObject(obj, evaluation.chunkId);
    if (!evaluation.chunkId) {
      evaluation = await evaluationsService.upsertEvaluation({ ...evaluation, chunkId }, username);
    }
    res.json(evaluation);
  });

  app.put('/api/evaluations/:id', auth, async (req, res, next) => {
    const { id } = req.params;
    const { username } = req.user;
    let evaluation = await evaluationsService.getEvaluation(id);
    let values = { ...evaluation, ...req.body };
    if (values.scheduleStatus !== 'paused') {
      if (hasValue(values.schedule)) {
        logger.debug('scheduling evaluation:', values);
        if (values.scheduleId) {
          await workflowClient.deleteSchedule(values.scheduleId, {
            address: constants.TEMPORAL_URL,
          });
        }
        const scheduleId = await workflowClient.scheduleEvaluation(values, values.workspaceId, username, {
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
    evaluation = await evaluationsService.upsertEvaluation(values, username);
    const obj = createSearchableObject(evaluation);
    const chunkId = await indexObject(obj, evaluation.chunkId);
    if (!evaluation.chunkId) {
      evaluation = await evaluationsService.upsertEvaluation({ ...evaluation, chunkId }, username);
    }
    res.json(evaluation);
  });

  app.delete('/api/evaluations/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    const evaluation = await evaluationsService.getEvaluation(id);
    if (evaluation.scheduleId) {
      await workflowClient.deleteSchedule(evaluation.scheduleId, {
        address: constants.TEMPORAL_URL,
      });
    }
    await evaluationsService.deleteEvaluations([id]);
    await deleteObject(objectId(id));
    res.json(id);
  });

  app.delete('/api/evaluations', auth, async (req, res, next) => {
    const ids = req.query.ids.split(',');
    for (const id of ids) {
      const evaluation = await evaluationsService.getEvaluation(id);
      if (evaluation.scheduleId) {
        await workflowClient.deleteSchedule(evaluation.scheduleId, {
          address: constants.TEMPORAL_URL,
        });
      }
    }
    await evaluationsService.deleteEvaluations(ids);
    await deleteObjects(ids.map(objectId));
    res.json(ids);
  });

  app.post('/api/evaluation-runs/:id', auth, async (req, res, next) => {
    const { username } = req.user;
    const { correlationId, workspaceId } = req.body;
    const eval_ = await evaluationsService.getEvaluation(req.params.id);
    workflowClient
      .evaluate(eval_, workspaceId, username, {
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
      label: 'Evaluation',
      type: OBJECT_TYPE,
      name: rec.name,
      text,
      createdDateTime: rec.created,
      createdBy: rec.createdBy,
      workspaceId: String(rec.workspaceId),
      metadata: {},
    };
  }

};
