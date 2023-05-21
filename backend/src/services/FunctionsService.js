const omit = require('lodash.omit');

function FunctionsService({ pg, logger }) {

  async function getFunctions(workspaceId) {
    let q = `
      SELECT id, workspace_id, name, created, created_by, modified, modified_by, val
      FROM functions
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
    const functions = rows.map((row) => ({
      ...row.val,
      id: row.id,
      name: row.name,
      workspaceId: row.workspaceId,
      created: row.created,
      createdBy: row.created_by,
      modified: row.modified,
      modifiedBy: row.modified_by,
    }));
    return functions;
  }

  async function getFunctionByName(name) {
    if (name === null || typeof name === 'undefined') {
      return null;
    }
    let q = `
      SELECT id, workspace_id, name, created, created_by, modified, modified_by, val
      FROM functions
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

  async function getFunction(id) {
    if (id === null || typeof id === 'undefined') {
      return null;
    }
    let q = `
      SELECT id, workspace_id, name, created, created_by, modified, modified_by, val
      FROM functions
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

  async function upsertFunction(func) {
    if (func === null || typeof func === 'undefined') {
      return null;
    }
    const val = omit(func, ['id', 'workspaceId', 'name', 'created', 'createdBy', 'modified', 'modifiedBy']);
    const savedFunction = await getFunction(func.id);
    if (savedFunction) {
      await pg.query(`
        UPDATE functions
        SET name = $1, val = $2
        WHERE id = $3
        `,
        [func.name, val, func.id]
      );
      return func.id;
    } else {
      const { rows } = await pg.query(`
        INSERT INTO functions (workspace_id, name, val)
        VALUES ($1, $2, $3) RETURNING id
        `,
        [func.workspaceId, func.name, val]
      );
      return rows[0].id;
    }
  }

  async function deleteFunctions(ids) {
    if (ids === null || typeof ids === 'undefined') {
      return [];
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return [];
    }
    await pg.query(`
      DELETE FROM functions WHERE id = ANY($1::INT[])
      `, [ids]);
    return ids;
  }

  return {
    getFunctions,
    getFunctionByName,
    getFunction,
    upsertFunction,
    deleteFunctions,
  };
}

module.exports = {
  FunctionsService,
};
