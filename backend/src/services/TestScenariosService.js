import omit from 'lodash.omit';

export function TestScenariosService({ pg, logger }) {
  function mapRow(row) {
    return {
      ...row.val,
      id: row.id,
      workspaceId: row.workspace_id,
      name: row.name,
      created: row.created,
      createdBy: row.created_by,
      modified: row.modified,
      modifiedBy: row.modified_by,
    };
  }

  async function getTestScenariosCount(workspaceId) {
    if (workspaceId === null || typeof workspaceId === 'undefined') {
      return -1;
    }
    let q = `
      SELECT COUNT(id) AS k
      FROM test_scenarios
      WHERE workspace_id = $1
      `;
    const { rows } = await pg.query(q, [workspaceId]);
    if (rows.length === 0) {
      return 0;
    }
    return rows[0].k;
  }

  async function getTestScenarios(workspaceId) {
    if (workspaceId === null || typeof workspaceId === 'undefined') {
      return [];
    }
    let q = `
      SELECT id, workspace_id, name, created, created_by, modified, modified_by, val
      FROM test_scenarios
      WHERE workspace_id = $1
      `;
    const { rows } = await pg.query(q, [workspaceId]);
    if (rows.length === 0) {
      return [];
    }
    return rows.map(mapRow);
  }

  async function getTestScenario(id) {
    if (id === null || typeof id === 'undefined') {
      return null;
    }
    let q = `
      SELECT id, workspace_id, name, created, created_by, modified, modified_by, val
      FROM test_scenarios
      WHERE id = $1
      `;
    const { rows } = await pg.query(q, [id]);
    if (rows.length === 0) {
      return null;
    }
    return mapRow(rows[0]);
  }

  async function upsertTestScenario(testScenario, username, partial) {
    if (testScenario === null || typeof testScenario === 'undefined') {
      return null;
    }
    const omittedFields = ['id', 'workspaceId', 'name', 'created', 'createdBy', 'modified', 'modifiedBy'];
    const savedTestScenario = await getTestScenario(testScenario.id);
    if (savedTestScenario) {
      if (partial) {
        testScenario = { ...savedTestScenario, ...testScenario };
      }
      const val = omit(testScenario, omittedFields);
      const modified = new Date();
      const { rows } = await pg.query(
        `
        UPDATE test_scenarios
        SET name = $1, val = $2, modified_by = $3, modified = $4
        WHERE id = $5
        RETURNING *
        `,
        [testScenario.name, val, username, modified, testScenario.id]
      );
      return mapRow(rows[0]);
    } else {
      const val = omit(testScenario, omittedFields);
      const created = new Date();
      const { rows } = await pg.query(
        `
        INSERT INTO test_scenarios (workspace_id, name, val, created_by, created, modified_by, modified)
        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
        `,
        [testScenario.workspaceId, testScenario.name, val, username, created, username, created]
      );
      return mapRow(rows[0]);
    }
  }

  async function deleteTestScenarios(ids) {
    if (ids === null || typeof ids === 'undefined') {
      return [];
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return [];
    }
    await pg.query(
      `
      DELETE FROM test_scenarios WHERE id = ANY($1::INT[])
      `,
      [ids]
    );
    return ids;
  }

  return {
    getTestScenariosCount,
    getTestScenarios,
    getTestScenario,
    upsertTestScenario,
    deleteTestScenarios,
  };
}
