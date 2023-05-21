const omit = require('lodash.omit');

function AppsService({ pg, logger }) {

  async function getApps(workspaceId, limit = 999, start = 0) {
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

  async function upsertApp(app) {
    let val;
    const savedApp = await getApp(app.id);
    if (savedApp) {
      app = { ...savedApp, ...app };
      val = omit(app, ['id', 'workspaceId', 'name', 'created', 'createdBy', 'modified', 'modifiedBy']);
      await pg.query(`
        UPDATE apps
        SET name = $1, val = $2
        WHERE id = $3
        `,
        [app.name, val, app.id]
      );
      return app.id;
    } else {
      val = omit(app, ['id', 'workspaceId', 'name', 'created', 'createdBy', 'modified', 'modifiedBy']);
      const { rows } = await pg.query(`
        INSERT INTO apps (workspace_id, name, val)
        VALUES ($1, $2, $3) RETURNING id
        `,
        [app.workspaceId, app.name, val]
      );
      return rows[0].id;
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

module.exports = {
  AppsService,
};
