const omit = require('lodash.omit');

function CompositionsService({ pg, logger }) {

  async function getCompositions(workspaceId) {
    let q = `
      SELECT id, workspace_id, name, created, created_by, modified, modified_by, val
      FROM compositions
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
    const compositions = rows.map((row) => ({
      ...row.val,
      id: row.id,
      name: row.name,
      workspaceId: row.workspaceId,
      created: row.created,
      createdBy: row.created_by,
      modified: row.modified,
      modifiedBy: row.modified_by,
    }));
    return compositions;
  }

  async function getCompositionByName(name) {
    if (name === null || typeof name === 'undefined') {
      return null;
    }
    let q = `
      SELECT id, workspace_id, name, created, created_by, modified, modified_by, val
      FROM compositions
      WHERE name = $1
      `;
    const { rows } = await pg.query(q, [name]);
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

  async function getComposition(id) {
    if (id === null || typeof id === 'undefined') {
      return null;
    }
    let q = `
      SELECT id, workspace_id, name, created, created_by, modified, modified_by, val
      FROM compositions
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

  async function upsertComposition(func) {
    if (func === null || typeof func === 'undefined') {
      return null;
    }
    const val = omit(func, ['id', 'workspaceId', 'name', 'created', 'createdBy', 'modified', 'modifiedBy']);
    const savedComposition = await getComposition(func.id);
    if (savedComposition) {
      await pg.query(`
        UPDATE compositions
        SET name = $1, val = $2
        WHERE id = $3
        `,
        [func.name, val, func.id]
      );
      return func.id;
    } else {
      const { rows } = await pg.query(`
        INSERT INTO compositions (workspace_id, name, val)
        VALUES ($1, $2, $3) RETURNING id
        `,
        [func.workspaceId, func.name, val]
      );
      return rows[0].id;
    }
  }

  async function deleteCompositions(ids) {
    if (ids === null || typeof ids === 'undefined') {
      return [];
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return [];
    }
    await pg.query(`
      DELETE FROM compositions WHERE id = ANY($1::INT[])
      `, [ids]);
    return ids;
  }

  return {
    getCompositions,
    getCompositionByName,
    getComposition,
    upsertComposition,
    deleteCompositions,
  };
}

module.exports = {
  CompositionsService,
};
