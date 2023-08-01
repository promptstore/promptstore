const omit = require('lodash.omit');

function TracesService({ pg, logger }) {

  async function getTraces(workspaceId) {
    let q = `
      SELECT id, workspace_id, name, created, created_by, modified, modified_by, val
      FROM traces
      `;
    let params = [];
    if (workspaceId) {
      q += `WHERE workspace_id = $1`;
      params = [workspaceId];
    }
    const { rows } = await pg.query(q, params);
    if (rows.length === 0) {
      return [];
    }
    const traces = rows.map((row) => ({
      ...row.val,
      id: row.id,
      name: row.name,
      workspaceId: row.workspaceId,
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
      workspaceId: row.workspaceId,
      created: row.created,
      createdBy: row.created_by,
      modified: row.modified,
      modifiedBy: row.modified_by,
    };
  }

  async function upsertTrace(session) {
    if (session === null || typeof session === 'undefined') {
      return null;
    }
    const val = omit(session, ['id', 'workspaceId', 'name', 'created', 'createdBy', 'modified', 'modifiedBy']);
    const savedTrace = await getTrace(session.id);
    if (savedTrace) {
      await pg.query(`
        UPDATE traces
        SET val = $1
        WHERE id = $2
        `,
        [val, session.id]
      );
      return session.id;
    } else {
      const { rows } = await pg.query(`
        INSERT INTO traces (workspace_id, name, val)
        VALUES ($1, $2, $3) RETURNING id
        `,
        [session.workspaceId, session.name, val]
      );
      return rows[0].id;
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

module.exports = {
  TracesService,
};
