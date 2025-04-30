import searchFunctions from '../searchFunctions';

export default ({ app, auth, constants, logger, services, workflowClient }) => {
  const OBJECT_TYPE = 'test-scenarios';

  const { testCasesService, testScenariosService } = services;

  const { deleteObjects, deleteObject, indexObject } = searchFunctions({ constants, logger, services });

  // cache of results to poll
  const jobs = {};

  app.get('/api/test-scenario-run-status/:correlationId', auth, async (req, res) => {
    const { correlationId } = req.params;
    // logger.debug('checking upload status for:', correlationId);
    const result = jobs[correlationId];
    if (!result) {
      return res.sendStatus(423);
    }
    res.json(result);
    delete jobs[correlationId];
  });

  app.get('/api/workspaces/:workspaceId/test-scenarios', auth, async (req, res, next) => {
    const { workspaceId } = req.params;
    const testScenarios = await testScenariosService.getTestScenarios(workspaceId);
    res.json(testScenarios);
  });

  app.get('/api/test-scenarios/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    const testScenario = await testScenariosService.getTestScenario(id);
    const testCases = await testCasesService.getTestCasesByScenarioId(id);
    res.json({ ...testScenario, testCases });
  });

  app.post('/api/test-scenarios', auth, async (req, res, next) => {
    const { username } = req.user;
    const values = req.body;
    const scenario = { ...values, testCasesCount: values.testCases?.length || 0 };
    delete scenario.testCases;
    let testScenario = await testScenariosService.upsertTestScenario(scenario, username);
    const testCases = [];
    if (values.testCases) {
      let index = 0;
      for (const testCase of values.testCases) {
        const tc = await testCasesService.upsertTestCase(
          {
            ...testCase,
            index,
            testScenarioId: testScenario.id,
            workspaceId: testScenario.workspaceId,
            functionId: testScenario.functionId,
          },
          username
        );
        testCases.push(tc);
        index++;
      }
    }
    const obj = createSearchableObject(testScenario);
    const chunkId = await indexObject(obj, testScenario.chunkId);
    if (!testScenario.chunkId) {
      testScenario = await testScenariosService.upsertTestScenario({ ...testScenario, chunkId }, username);
    }
    res.json({ ...testScenario, testCases });
  });

  const updateTestScenario = async (id, values, username) => {
    const scenario = { ...values, testCasesCount: values.testCases?.length || 0 };
    delete scenario.testCases;
    let testScenario = await testScenariosService.upsertTestScenario({ id, ...scenario }, username);
    const existingTestCases = await testCasesService.getTestCasesByScenarioId(id);
    const existingIds = existingTestCases.reduce((a, tc) => {
      a[tc.id] = true;
      return a;
    }, {});
    const testCases = [];
    let index = 0;
    for (const testCase of values.testCases) {
      existingIds[testCase.id] = false;
      const tc = await testCasesService.upsertTestCase(
        {
          ...testCase,
          index,
          testScenarioId: testScenario.id,
          workspaceId: testScenario.workspaceId,
          functionId: testScenario.functionId,
        },
        username
      );
      testCases.push(tc);
      index++;
    }
    const removedIds = Object.keys(existingIds).filter(id => existingIds[id]);
    await testCasesService.deleteTestCases(removedIds);
    const obj = createSearchableObject(testScenario);
    const chunkId = await indexObject(obj, testScenario.chunkId);
    if (!testScenario.chunkId) {
      testScenario = await testScenariosService.upsertTestScenario({ ...testScenario, chunkId }, username);
    }
    return { ...testScenario, testCases };
  };

  app.put('/api/test-scenarios/:id', auth, async (req, res, next) => {
    const { id } = req.params;
    const { username } = req.user;
    const values = req.body;
    const scenario = await updateTestScenario(id, values, username);
    res.json(scenario);
  });

  app.delete('/api/test-scenarios/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    await testScenariosService.deleteTestScenarios([id]);
    await deleteObject(objectId(id));
    res.json(id);
  });

  app.delete('/api/test-scenarios', auth, async (req, res, next) => {
    const ids = req.query.ids.split(',');
    await testScenariosService.deleteTestScenarios(ids);
    await testCasesService.deleteTestCasesForScenarios(ids);
    await deleteObjects(ids.map(objectId));
    res.json(ids);
  });

  app.post('/api/test-scenario-runs', auth, async (req, res, next) => {
    const { username } = req.user;
    const { correlationId, testScenarioId, workspaceId, values, selectedRowKeys } = req.body;
    await updateTestScenario(testScenarioId, values, username);
    workflowClient
      .executeTestScenario(
        { testScenarioId, username, workspaceId, selectedRowKeys },
        {
          address: constants.TEMPORAL_URL,
        }
      )
      .then(result => {
        // logger.debug('batch test scenario result:', result);
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

  const objectId = id => OBJECT_TYPE + ':' + id;

  function createSearchableObject(rec) {
    const texts = [rec.name];
    const text = texts.filter(t => t).join('\n');
    return {
      id: objectId(rec.id),
      nodeLabel: 'Object',
      label: 'TestScenario',
      type: OBJECT_TYPE,
      name: rec.name,
      text,
      createdDateTime: rec.created,
      createdBy: rec.createdBy,
      workspaceId: String(rec.workspaceId),
      metadata: {
        type: rec.type,
      },
    };
  }
};
