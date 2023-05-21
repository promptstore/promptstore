const omit = require('lodash.omit');

function WorkspacesService({ pg, logger }) {

  async function getWorkspaces(limit = 999, start = 0) {
    let q = `
      SELECT id, name, created, created_by, modified, modified_by, val
      FROM workspaces
      LIMIT ${limit} OFFSET ${start}
      `;
    const { rows } = await pg.query(q);
    const workspaces = rows.map((row) => ({
      ...row.val,
      id: row.id,
      name: row.name,
      created: row.created,
      createdBy: row.created_by,
      modified: row.modified,
      modifiedBy: row.modified_by,
    }));
    return workspaces;
  }

  async function getWorkspacesByUser(username, limit = 999, start = 0) {
    let q = `
      SELECT id, name, created, created_by, modified, modified_by, val
      FROM workspaces p
      WHERE $1 = ANY(json_property_to_int_array(p.val->'members', 'id'))
      LIMIT $2 OFFSET $3
      `;
    const { rows } = await pg.query(q, [username, limit, start]);
    const workspaces = rows.map((row) => ({
      ...row.val,
      id: row.id,
      name: row.name,
      created: row.created,
      createdBy: row.created_by,
      modified: row.modified,
      modifiedBy: row.modified_by,
    }));
    return workspaces;
  }

  async function getWorkspace(id) {
    if (id === null || typeof id === 'undefined') {
      return null;
    }
    let q = `
      SELECT id, name, created, created_by, modified, modified_by, val
      FROM workspaces
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
      created: row.created,
      createdBy: row.created_by,
      modified: row.modified,
      modifiedBy: row.modified_by,
    };
  }

  async function upsertWorkspace(workspace) {
    const val = omit(workspace, ['id', 'name', 'created', 'createdBy', 'modified', 'modifiedBy']);
    const savedWorkspace = await getWorkspace(workspace.id);
    if (savedWorkspace) {
      await pg.query(`
        UPDATE workspaces
        SET name = $1, val = $2
        WHERE id = $3
        `,
        [workspace.name, val, workspace.id]
      );
      return workspace.id;
    } else {
      const { rows } = await pg.query(`
        INSERT INTO workspaces (name, val)
        VALUES ($1, $2) RETURNING id
        `,
        [workspace.name, workspace]
      );
      return rows[0].id;
    }
  }

  async function deleteWorkspaces(ids) {
    await pg.query(`
      DELETE FROM workspaces WHERE id = ANY($1::INT[])
      `, [ids]);
    return ids;
  }

  return {
    deleteWorkspaces,
    getWorkspaces,
    getWorkspacesByUser,
    getWorkspace,
    upsertWorkspace,
  };
}

module.exports = {
  WorkspacesService,
};
