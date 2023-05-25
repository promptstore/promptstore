const omit = require('lodash.omit');

function SettingsService({ pg, logger }) {

  async function getSettings(workspaceId) {
    let q = `
      SELECT id, workspace_id, key, created, created_by, modified, modified_by, val
      FROM settings
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
    const settings = rows.map((row) => ({
      ...row.val,
      name: row.val.name || row.key,
      id: row.id,
      workspaceId: row.workspaceId,
      key: row.key,
      created: row.created,
      createdBy: row.created_by,
      modified: row.modified,
      modifiedBy: row.modified_by,
    }));
    return settings;
  }

  async function getSettingByKey(key) {
    if (key === null || typeof key === 'undefined') {
      return null;
    }
    let q = `
      SELECT id, workspace_id, key, created, created_by, modified, modified_by, val
      FROM settings
      WHERE key = $1
      `;
    const { rows } = await pg.query(q, [key]);
    if (rows.length === 0) {
      return null;
    }
    logger.debug('rows: ', rows);
    const row = rows[0];
    return {
      ...row.val,
      name: row.val.name || row.key,
      id: row.id,
      workspaceId: row.workspaceId,
      key: row.key,
      created: row.created,
      createdBy: row.created_by,
      modified: row.modified,
      modifiedBy: row.modified_by,
    };
  }

  async function getSetting(id) {
    if (id === null || typeof id === 'undefined') {
      return null;
    }
    let q = `
      SELECT id, workspace_id, key, created, created_by, modified, modified_by, val
      FROM settings
      WHERE id = $1
      `;
    const { rows } = await pg.query(q, [id]);
    if (rows.length === 0) {
      return null;
    }
    const row = rows[0];
    return {
      ...row.val,
      name: row.val.name || row.key,
      id: row.id,
      workspaceId: row.workspaceId,
      key: row.key,
      created: row.created,
      createdBy: row.created_by,
      modified: row.modified,
      modifiedBy: row.modified_by,
    };
  }

  async function upsertSetting(setting) {
    if (setting === null || typeof setting === 'undefined') {
      return null;
    }
    const val = omit(setting, ['id', 'workspaceId', 'key', 'created', 'createdBy', 'modified', 'modifiedBy']);
    const savedSetting = await getSetting(setting.id);
    if (savedSetting) {
      await pg.query(`
        UPDATE settings
        SET val = $1
        WHERE id = $2
        `,
        [val, setting.id]
      );
      return setting.id;
    } else {
      const { rows } = await pg.query(`
        INSERT INTO settings (workspace_id, key, val)
        VALUES ($1, $2, $3) RETURNING id
        `,
        [setting.workspaceId, setting.key, val]
      );
      return rows[0].id;
    }
  }

  async function deleteSettings(ids) {
    if (ids === null || typeof ids === 'undefined') {
      return [];
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return [];
    }
    await pg.query(`
      DELETE FROM settings WHERE id = ANY($1::INT[])
      `, [ids]);
    return ids;
  }

  return {
    getSettings,
    getSettingByKey,
    getSetting,
    upsertSetting,
    deleteSettings,
  };
}

module.exports = {
  SettingsService,
};
