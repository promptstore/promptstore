import omit from 'lodash.omit';

export function AppsService({ pg, logger }) {

  async function getApps(workspaceId, limit = 999, start = 0) {
    if (workspaceId === null || typeof workspaceId === 'undefined') {
      return [];
    }
    let q = `
      SELECT id, workspace_id, name, created, created_by, modified, modified_by, val
      FROM apps
      WHERE workspace_id = $1
      LIMIT $2 OFFSET $3
      `;
    const { rows } = await pg.query(q, [workspaceId, limit, start]);
    const apps = rows.map((row) => ({
      ...row.val,
      id: row.id,
      workspaceId: row.workspace_id,
      name: row.name,
      created: row.created,
      createdBy: row.created_by,
      modified: row.modified,
      modifiedBy: row.modified_by,
    }));
    return apps;
  }

  async function getApp(id) {
    if (id === null || typeof id === 'undefined') {
      return null;
    }
    let q = `
      SELECT id, workspace_id, name, created, created_by, modified, modified_by, val
      FROM apps
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
      workspaceId: row.workspace_id,
      name: row.name,
      created: row.created,
      createdBy: row.created_by,
      modified: row.modified,
      modifiedBy: row.modified_by,
    };
  }

  async function upsertApp(app, username) {
    if (app === null || typeof app === 'undefined') {
      return null;
    }
    const val = omit(app, ['id', 'workspaceId', 'name', 'created', 'createdBy', 'modified', 'modifiedBy']);
    const savedApp = await getApp(app.id);
    if (savedApp) {
      app = { ...savedApp, ...app };
      await pg.query(`
        UPDATE apps
        SET name = $1, val = $2, modified_by = $3, modified = $4
        WHERE id = $5
        `,
        [app.name, val, username, new Date(), app.id]
      );
      return { ...savedApp, ...app };
    } else {
      const created = new Date();
      const { rows } = await pg.query(`
        INSERT INTO apps (workspace_id, name, val, created_by, created, modified_by, modified)
        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
        `,
        [app.workspaceId, app.name, val, username, created, username, created]
      );
      return { ...app, id: rows[0].id };
    }
  }

  async function deleteApps(ids) {
    await pg.query(`
      DELETE FROM apps WHERE id = ANY($1::INT[])
      `, [ids]);
    return ids;
  }

  return {
    deleteApps,
    getApps,
    getApp,
    upsertApp,
  };
}
