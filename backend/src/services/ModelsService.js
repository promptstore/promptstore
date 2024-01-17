import omit from 'lodash.omit';

export function ModelsService({ pg, logger }) {

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

  async function getModels(workspaceId) {
    if (workspaceId === null || typeof workspaceId === 'undefined') {
      return [];
    }
    let q = `
      SELECT id, workspace_id, name, created, created_by, modified, modified_by, val
      FROM models
      WHERE workspace_id = $1 OR workspace_id = 1
      OR (val->>'isPublic')::boolean = true
      `;
    const { rows } = await pg.query(q, [workspaceId]);
    if (rows.length === 0) {
      return [];
    }
    return rows.map(mapRow);
  }

  async function getModelsByName(workspaceId, name) {
    if (workspaceId === null || typeof workspaceId === 'undefined') {
      return [];
    }
    if (name === null || typeof name === 'undefined') {
      return [];
    }
    let q = `
      SELECT id, workspace_id, name, created, created_by, modified, modified_by, val
      FROM models
      WHERE (workspace_id = $1 OR workspace_id = 1 OR (val->>'isPublic')::boolean = true)
      AND name LIKE $2 || '%'
      `;
    const { rows } = await pg.query(q, [workspaceId, name]);
    if (rows.length === 0) {
      return [];
    }
    return rows.map(mapRow);
  }

  async function getModelsByType(workspaceId, type) {
    if (workspaceId === null || typeof workspaceId === 'undefined') {
      return [];
    }
    if (type === null || typeof type === 'undefined') {
      return [];
    }
    let q = `
      SELECT id, workspace_id, name, created, created_by, modified, modified_by, val
      FROM models
      WHERE (workspace_id = $1 OR workspace_id = 1 OR (val->>'isPublic')::boolean = true)
      AND val->>'type' = $2
      `;
    const { rows } = await pg.query(q, [workspaceId, type]);
    if (rows.length === 0) {
      return [];
    }
    return rows.map(mapRow);
  }

  async function getModelByKey(workspaceId, key) {
    if (workspaceId === null || typeof workspaceId === 'undefined') {
      return null;
    }
    if (key === null || typeof key === 'undefined') {
      return null;
    }
    let q = `
      SELECT id, workspace_id, name, created, created_by, modified, modified_by, val
      FROM models
      WHERE (workspace_id = $1 OR workspace_id = 1 OR (val->>'isPublic')::boolean = true)
      AND val->>'key' = $2
      `;
    const { rows } = await pg.query(q, [workspaceId, key]);
    if (rows.length === 0) {
      return null;
    }
    return mapRow(rows[0]);
  }

  async function getModelByName(workspaceId, name) {
    if (workspaceId === null || typeof workspaceId === 'undefined') {
      return null;
    }
    if (name === null || typeof name === 'undefined') {
      return null;
    }
    let q = `
      SELECT id, workspace_id, name, created, created_by, modified, modified_by, val
      FROM models
      WHERE (workspace_id = $1 OR workspace_id = 1 OR (val->>'isPublic')::boolean = true)
      AND name = $2
      `;
    const { rows } = await pg.query(q, [workspaceId, name]);
    if (rows.length === 0) {
      return null;
    }
    return mapRow(rows[0]);
  }

  async function getModel(id) {
    if (id === null || typeof id === 'undefined') {
      return null;
    }
    let q = `
      SELECT id, workspace_id, name, created, created_by, modified, modified_by, val
      FROM models
      WHERE id = $1
      `;
    const { rows } = await pg.query(q, [id]);
    if (rows.length === 0) {
      return null;
    }
    return mapRow(rows[0]);
  }

  async function upsertModel(model, username) {
    if (model === null || typeof model === 'undefined') {
      return null;
    }
    const val = omit(model, ['id', 'workspaceId', 'name', 'created', 'createdBy', 'modified', 'modifiedBy']);
    const savedModel = await getModel(model.id);
    if (savedModel) {
      const modified = new Date();
      const { rows } = await pg.query(`
        UPDATE models
        SET name = $1, val = $2, modified_by = $3, modified = $4
        WHERE id = $5
        RETURNING *
        `,
        [model.name, val, username, modified, model.id]
      );
      return mapRow(rows[0]);
    } else {
      const created = new Date();
      const { rows } = await pg.query(`
        INSERT INTO models (workspace_id, name, val, created_by, created, modified_by, modified)
        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
        `,
        [model.workspaceId, model.name, val, username, created, username, created]
      );
      return mapRow(rows[0]);
    }
  }

  async function deleteModels(ids) {
    if (ids === null || typeof ids === 'undefined') {
      return [];
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return [];
    }
    await pg.query(`
      DELETE FROM models WHERE id = ANY($1::INT[])
      `, [ids]);
    return ids;
  }

  return {
    getModels,
    getModelsByName,
    getModelsByType,
    getModelByKey,
    getModelByName,
    getModel,
    upsertModel,
    deleteModels,
  };
}
