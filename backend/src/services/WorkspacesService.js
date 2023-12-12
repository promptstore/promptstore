import omit from 'lodash.omit';

export function WorkspacesService({ pg, logger }) {

  function mapRow(row) {
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

  async function getWorkspaces(limit = 999, start = 0) {
    let q = `
      SELECT id, name, created, created_by, modified, modified_by, val
      FROM workspaces
      LIMIT ${limit} OFFSET ${start}
      `;
    const { rows } = await pg.query(q);
    return rows.map(mapRow);
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
    return rows.map(mapRow);
  }

  async function getUsernameByApiKey(apiKey) {
    let q = `
      SELECT id, val->'apiKeys'->'${apiKey}'->>'username' AS username
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
    return mapRow(rows[0]);
  }

  async function upsertWorkspace(workspace, user) {
    let val = omit(workspace, ['id', 'name', 'created', 'createdBy', 'modified', 'modifiedBy']);
    const savedWorkspace = await getWorkspace(workspace.id);
    if (savedWorkspace) {
      const modified = new Date();
      const { rows } = await pg.query(`
        UPDATE workspaces
        SET name = $1, val = $2, modified = $3, modified_by = $4
        WHERE id = $5
        RETURNING *
        `,
        [workspace.name, val, modified, user.username, workspace.id]
      );
      return mapRow(rows[0]);
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
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
        `,
        [workspace.name, val, created, user.username, created, user.username]
      );
      return mapRow(rows[0]);
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
