import omit from 'lodash.omit';

export function EvaluationsService({ pg, logger }) {

  function mapRow(row) {
    return {
      ...row.val,
      id: row.id,
      name: row.name,
      workspaceId: row.workspace_id,
      created: row.created,
      createdBy: row.created_by,
      modified: row.modified,
      modifiedBy: row.modified_by,
    };
  }

  function mapEvalRun(row) {
    const runs = row.val.runs;
    if (runs?.length) {
      const latest = runs[runs.length - 1];
      const val = row.val;
      let selectionStartDate, selectionEndDate;
      const [start, end] = row.dateRange || [];
      if (start) {
        selectionStartDate = start;
      }
      if (end) {
        selectionEndDate = end;
      }
      return {
        evaluationId: row.id,
        name: row.name,
        model: val.model,
        evalFunction: val.evalFunction,
        completionFunction: val.completionFunction,
        criterion: val.criterion,
        selectionStartDate,
        selectionEndDate,
        runDate: latest.runDate,
        allTestsPassed: latest.allTestsPassed,
        numberFailed: latest.numberFailed,
        numberTests: latest.numberTests,
        percentPassed: latest.percentPassed,
        workspaceId: row.workspace_id,
      };
    }
    return null;
  }

  async function getEvaluations(workspaceId) {
    if (workspaceId === null || typeof workspaceId === 'undefined') {
      return [];
    }
    let q = `
      SELECT id, workspace_id, name, created, created_by, modified, modified_by, val
      FROM evaluations
      WHERE workspace_id = $1
      ORDER BY created DESC
      LIMIT 100
      `;
    const { rows } = await pg.query(q, [workspaceId]);
    if (rows.length === 0) {
      return [];
    }
    return rows.map(mapRow);
  }

  async function getEvalRuns(workspaceId) {
    if (workspaceId === null || typeof workspaceId === 'undefined') {
      return [];
    }
    let q = `
      SELECT id, workspace_id, name, created, created_by, modified, modified_by, val
      FROM evaluations
      WHERE workspace_id = $1
      ORDER BY created DESC
      LIMIT 100
      `;
    const { rows } = await pg.query(q, [workspaceId]);
    if (rows.length === 0) {
      return [];
    }
    return rows.map(mapEvalRun).filter(v => v);
  }

  async function getEvaluation(id) {
    if (id === null || typeof id === 'undefined') {
      return null;
    }
    let q = `
      SELECT id, workspace_id, name, created, created_by, modified, modified_by, val
      FROM evaluations
      WHERE id = $1
      `;
    const { rows } = await pg.query(q, [id]);
    if (rows.length === 0) {
      return null;
    }
    return mapRow(rows[0]);
  }

  async function upsertEvaluation(evaluation, username) {
    if (evaluation === null || typeof evaluation === 'undefined') {
      return null;
    }
    const val = omit(evaluation, ['id', 'workspaceId', 'name', 'created', 'createdBy', 'modified', 'modifiedBy']);
    const savedEvaluation = await getEvaluation(evaluation.id);
    if (savedEvaluation) {
      const modified = new Date();
      const { rows } = await pg.query(`
        UPDATE evaluations
        SET name = $1, val = $2, modified_by = $3, modified = $4
        WHERE id = $5
        RETURNING *
        `,
        [evaluation.name, val, evaluation.id, modified, evaluation.id]
      );
      return mapRow(rows[0]);
    } else {
      const created = new Date();
      const { rows } = await pg.query(`
        INSERT INTO evaluations (workspace_id, name, val, created_by, created, modified_by, modified)
        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
        `,
        [evaluation.workspaceId, evaluation.name, val, username, created, username, created]
      );
      return mapRow(rows[0]);
    }
  }

  async function deleteEvaluations(ids) {
    if (ids === null || typeof ids === 'undefined') {
      return [];
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return [];
    }
    await pg.query(`
      DELETE FROM evaluations WHERE id = ANY($1::INT[])
      `, [ids]);
    return ids;
  }

  return {
    getEvaluations,
    getEvaluation,
    getEvalRuns,
    upsertEvaluation,
    deleteEvaluations,
  };
}
