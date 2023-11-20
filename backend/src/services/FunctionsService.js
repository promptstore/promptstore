import omit from 'lodash.omit';

export function FunctionsService({ pg, logger }) {

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

  async function getFunctions(workspaceId) {
    if (workspaceId === null || typeof workspaceId === 'undefined') {
      return [];
    }
    let q = `
      SELECT id, workspace_id, name, created, created_by, modified, modified_by, val
      FROM functions
      WHERE workspace_id = $1
      OR (val->>'isPublic')::boolean = true
      `;
    const { rows } = await pg.query(q, [workspaceId]);
    if (rows.length === 0) {
      return [];
    }
    return rows.map(mapRow);
  }

  async function getFunctionsByName(workspaceId, name) {
    if (workspaceId === null || typeof workspaceId === 'undefined') {
      return [];
    }
    if (name === null || typeof name === 'undefined') {
      return [];
    }
    let q = `
      SELECT id, workspace_id, name, created, created_by, modified, modified_by, val
      FROM functions
      WHERE (workspace_id = $1 OR (val->>'isPublic')::boolean = true)
      AND name LIKE $2 || '%'
      `;
    const { rows } = await pg.query(q, [workspaceId, name]);
    if (rows.length === 0) {
      return [];
    }
    return rows.map(mapRow);
  }

  async function getFunctionsByTag(workspaceId, tag) {
    if (workspaceId === null || typeof workspaceId === 'undefined') {
      return [];
    }
    if (tag === null || typeof tag === 'undefined') {
      return [];
    }
    let q = `
      SELECT id, workspace_id, name, created, created_by, modified, modified_by, val
      FROM functions f, json_array_elements_text(f.val->'tags') tag
      WHERE (workspace_id = $1 OR (val->>'isPublic')::boolean = true)
      AND tag = $2
      `;
    const { rows } = await pg.query(q, [workspaceId, tag]);
    if (rows.length === 0) {
      return [];
    }
    return rows.map(mapRow);
  }

  async function getFunctionByName(workspaceId, name) {
    if (workspaceId === null || typeof workspaceId === 'undefined') {
      return null;
    }
    if (name === null || typeof name === 'undefined') {
      return null;
    }
    let q = `
      SELECT id, workspace_id, name, created, created_by, modified, modified_by, val
      FROM functions
      WHERE (workspace_id = $1 OR (val->>'isPublic')::boolean = true)
      AND name = $2
      `;
    const { rows } = await pg.query(q, [workspaceId, name]);
    if (rows.length === 0) {
      return null;
    }
    return mapRow(rows[0]);
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
    return mapRow(rows[0]);
  }

  async function upsertFunction(func, username) {
    if (func === null || typeof func === 'undefined') {
      return null;
    }
    const val = omit(func, ['id', 'workspaceId', 'name', 'created', 'createdBy', 'modified', 'modifiedBy']);
    const savedFunction = await getFunction(func.id);
    if (savedFunction) {
      const modified = new Date();
      const { rows } = await pg.query(`
        UPDATE functions
        SET name = $1, val = $2, modified_by = $3, modified = $4
        WHERE id = $5
        RETURNING *
        `,
        [func.name, val, username, modified, func.id]
      );
      return mapRow(rows[0]);
    } else {
      const created = new Date();
      const { rows } = await pg.query(`
        INSERT INTO functions (workspace_id, name, val, created_by, created, modified_by, modified)
        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
        `,
        [func.workspaceId, func.name, val, username, created, username, created]
      );
      return { ...func, id: rows[0].id };
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
    getFunctionsByName,
    getFunctionsByTag,
    getFunctionByName,
    getFunction,
    upsertFunction,
    deleteFunctions,
  };
}
