import omit from 'lodash.omit';

export function WorkspacesService({ pg, logger }) {

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

  async function getWorkspacesByUser(userId, limit = 999, start = 0) {
    let q = `
      SELECT id, name, created, created_by, modified, modified_by, val
      FROM workspaces p
      WHERE $1 = ANY(json_property_to_int_array(p.val->'members', 'id'))
      OR (val->>'isPublic')::boolean = true
      LIMIT $2 OFFSET $3
      `;
    const { rows } = await pg.query(q, [userId, limit, start]);
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

  async function getUsernameByApiKey(apiKey) {
    let q = `
      SELECT id, val->'apiKeys'->>'${apiKey}' AS username
      FROM workspaces
      WHERE val->'apiKeys'->>'${apiKey}' <> ''
    `;
    logger.debug('q:', q);
    const { rows } = await pg.query(q);
    if (rows.length === 0) {
      return null;
    }
    const row = rows[0];
    return {
      workspaceId: row.id,
      username: row.username,
    };
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

  async function upsertWorkspace(workspace, user) {
    let val = omit(workspace, ['id', 'name', 'created', 'createdBy', 'modified', 'modifiedBy']);
    const savedWorkspace = await getWorkspace(workspace.id);
    if (savedWorkspace) {
      await pg.query(`
        UPDATE workspaces
        SET name = $1, val = $2, modified = $3, modified_by = $4
        WHERE id = $5
        `,
        [workspace.name, val, new Date(), user.username, workspace.id]
      );
      return { ...savedWorkspace, ...workspace };
    } else {
      val = {
        ...val,
        members: [
          {
            id: user.id,
            fullName: user.fullName,
            username: user.username,
            email: user.email,
          }
        ]
      };
      const created = new Date();
      const { rows } = await pg.query(`
        INSERT INTO workspaces (name, val, created, created_by, modified, modified_by)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
        `,
        [workspace.name, val, created, user.username, created, user.username]
      );
      return { ...workspace, ...val, id: rows[0].id };
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
    getUsernameByApiKey,
    getWorkspaces,
    getWorkspacesByUser,
    getWorkspace,
    upsertWorkspace,
  };
}
