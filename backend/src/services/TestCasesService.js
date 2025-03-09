import omit from 'lodash.omit';

export function TestCasesService({ pg, logger }) {
  function mapRow(row) {
    return {
      ...row.val,
      id: row.id,
      workspaceId: row.workspace_id,
      scenarioId: row.test_scenario_id,
      functionId: row.function_id,
      input: row.input,
      output: row.output,
      rating: row.rating,
      created: row.created,
      createdBy: row.created_by,
      modified: row.modified,
      modifiedBy: row.modified_by,
    };
  }

  async function getTestCasesCount(workspaceId) {
    if (workspaceId === null || typeof workspaceId === 'undefined') {
      return -1;
    }
    let q = `
      SELECT COUNT(id) AS k
      FROM test_cases
      WHERE workspace_id = $1
      `;
    const { rows } = await pg.query(q, [workspaceId]);
    if (rows.length === 0) {
      return 0;
    }
    return rows[0].k;
  }

  async function getTestCases(workspaceId) {
    if (workspaceId === null || typeof workspaceId === 'undefined') {
      return [];
    }
    let q = `
      SELECT id, workspace_id, test_scenario_id, function_id, input, output, rating, created, created_by, modified, modified_by, val
      FROM test_cases
      WHERE workspace_id = $1
      `;
    const { rows } = await pg.query(q, [workspaceId]);
    if (rows.length === 0) {
      return [];
    }
    return rows.map(mapRow);
  }

  async function getTestCasesByScenarioId(scenarioId) {
    if (scenarioId === null || typeof scenarioId === 'undefined') {
      return [];
    }
    let q = `
      SELECT id, workspace_id, test_scenario_id, function_id, input, output, rating, created, created_by, modified, modified_by, val
      FROM test_cases
      WHERE test_scenario_id = $1
      `;
    const { rows } = await pg.query(q, [scenarioId]);
    if (rows.length === 0) {
      return [];
    }
    return rows.map(mapRow);
  }

  async function getTestCase(id) {
    if (id === null || typeof id === 'undefined') {
      return null;
    }
    let q = `
      SELECT id, workspace_id, test_scenario_id, function_id, input, output, rating, created, created_by, modified, modified_by, val
      FROM test_cases
      WHERE id = $1
      `;
    const { rows } = await pg.query(q, [id]);
    if (rows.length === 0) {
      return null;
    }
    return mapRow(rows[0]);
  }

  async function upsertTestCase(testCase, username, partial) {
    if (testCase === null || typeof testCase === 'undefined') {
      return null;
    }
    const omittedFields = [
      'id',
      'workspaceId',
      'testScenarioId',
      'functionId',
      'input',
      'output',
      'rating',
      'created',
      'createdBy',
      'modified',
      'modifiedBy',
    ];
    const savedTestCase = await getTestCase(testCase.id);
    if (savedTestCase) {
      if (partial) {
        testCase = { ...savedTestCase, ...testCase };
      }
      const val = omit(testCase, omittedFields);
      const modified = new Date();
      const { rows } = await pg.query(
        `
        UPDATE test_cases
        SET function_id = $1, input = $2, output = $3, rating = $4, val = $5, modified_by = $6, modified = $7
        WHERE id = $8
        RETURNING *
        `,
        [
          testCase.functionId,
          testCase.input,
          testCase.output,
          testCase.rating,
          val,
          username,
          modified,
          testCase.id,
        ]
      );
      return mapRow(rows[0]);
    } else {
      const val = omit(testCase, omittedFields);
      const created = new Date();
      const { rows } = await pg.query(
        `
        INSERT INTO test_cases (workspace_id, test_scenario_id, function_id, input, output, rating, val, created_by, created, modified_by, modified)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *
        `,
        [
          testCase.workspaceId,
          testCase.testScenarioId,
          testCase.functionId,
          testCase.input,
          testCase.output,
          testCase.rating,
          val,
          username,
          created,
          username,
          created,
        ]
      );
      return mapRow(rows[0]);
    }
  }

  async function deleteTestCases(ids) {
    if (ids === null || typeof ids === 'undefined') {
      return [];
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return [];
    }
    await pg.query(
      `
      DELETE FROM test_cases WHERE id = ANY($1::INT[])
      `,
      [ids]
    );
    return ids;
  }

  async function deleteTestCasesForScenarios(scenarioIds) {
    if (scenarioIds === null || typeof scenarioIds === 'undefined') {
      return [];
    }
    if (!Array.isArray(scenarioIds) || scenarioIds.length === 0) {
      return [];
    }
    await pg.query(
      `
      DELETE FROM test_cases WHERE test_scenario_id = ANY($1::INT[])
      `,
      [scenarioIds]
    );
    return scenarioIds;
  }

  return {
    getTestCasesCount,
    getTestCases,
    getTestCasesByScenarioId,
    getTestCase,
    upsertTestCase,
    deleteTestCases,
    deleteTestCasesForScenarios,
  };
}
