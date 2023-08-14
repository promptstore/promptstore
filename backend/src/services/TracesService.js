import omit from 'lodash.omit';

export function TracesService({ pg, logger }) {

  async function getTraces(workspaceId) {
    if (workspaceId === null || typeof workspaceId === 'undefined') {
      return [];
    }
    let q = `
      SELECT id, workspace_id, name, created, created_by, modified, modified_by, val
      FROM traces
      WHERE workspace_id = $1
      ORDER BY created DESC
      LIMIT 100
      `;
    const { rows } = await pg.query(q, [workspaceId]);
    if (rows.length === 0) {
      return [];
    }
    const traces = rows.map((row) => ({
      ...row.val,
      id: row.id,
      name: row.name,
      workspaceId: row.workspace_id,
      created: row.created,
      createdBy: row.created_by,
      modified: row.modified,
      modifiedBy: row.modified_by,
    }));
    return traces;
  }

  async function getTrace(id) {
    if (id === null || typeof id === 'undefined') {
      return null;
    }
    let q = `
      SELECT id, workspace_id, name, created, created_by, modified, modified_by, val
      FROM traces
      WHERE id = $1
      `;
    const { rows } = await pg.query(q, [id]);
    if (rows.length === 0) {
      return null;
    }
    const row = rows[0];
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

  async function upsertTrace(trace, username) {
    if (trace === null || typeof trace === 'undefined') {
      return null;
    }
    const val = omit(trace, ['id', 'workspaceId', 'name', 'created', 'createdBy', 'modified', 'modifiedBy']);
    const savedTrace = await getTrace(trace.id);
    if (savedTrace) {
      await pg.query(`
        UPDATE traces
        SET name = $1, val = $2, modified_by = $3, modified = $4
        WHERE id = $5
        `,
        [trace.name, val, trace.id, new Date(), func.id]
      );
      return { ...savedTrace, ...trace };
    } else {
      const created = new Date();
      const { rows } = await pg.query(`
        INSERT INTO traces (workspace_id, name, val, created_by, created, modified_by, modified)
        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
        `,
        [trace.workspaceId, trace.name, val, username, created, username, created]
      );
      return { ...trace, id: rows[0].id };
    }
  }

  async function deleteTraces(ids) {
    if (ids === null || typeof ids === 'undefined') {
      return [];
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return [];
    }
    await pg.query(`
      DELETE FROM traces WHERE id = ANY($1::INT[])
      `, [ids]);
    return ids;
  }

  return {
    getTraces,
    getTrace,
    upsertTrace,
    deleteTraces,
  };
}
