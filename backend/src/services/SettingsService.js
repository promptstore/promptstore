import omit from 'lodash.omit';

export function SettingsService({ pg, logger }) {

  function mapRow(row) {
    return {
      ...row.val,
      name: row.val.name || row.key,
      id: row.id,
      workspaceId: row.workspace_id,
      key: row.key,
      created: row.created,
      createdBy: row.created_by,
      modified: row.modified,
      modifiedBy: row.modified_by,
    };
  }

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
    return rows.map(mapRow);
  }

  async function getSettingsByKey(workspaceId, key) {
    if (key === null || typeof key === 'undefined') {
      return null;
    }
    let q = `
      SELECT id, workspace_id, key, created, created_by, modified, modified_by, val
      FROM settings
      WHERE key = $1
      `;
    let params = [key];
    if (workspaceId) {
      q += `AND workspace_id = $2`;
      params.push(workspaceId);
    }
    const { rows } = await pg.query(q, params);
    if (rows.length === 0) {
      return [];
    }
    return rows.map(mapRow);
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
    return mapRow(rows[0]);
  }

  async function upsertSetting(setting, username) {
    if (setting === null || typeof setting === 'undefined') {
      return null;
    }
    const omittedFields = ['id', 'workspaceId', 'key', 'created', 'createdBy', 'modified', 'modifiedBy'];
    const savedSetting = await getSetting(setting.id);
    if (savedSetting) {
      setting = { ...savedSetting, ...setting };
      const val = omit(setting, omittedFields);
      const modified = new Date();
      const { rows } = await pg.query(`
        UPDATE settings
        SET val = $1, modified_by = $2, modified = $3
        WHERE id = $4
        RETURNING *
        `,
        [val, username, modified, setting.id]
      );
      return mapRow(rows[0]);

    } else {
      const val = omit(setting, omittedFields);
      const created = new Date();
      const { rows } = await pg.query(`
        INSERT INTO settings (workspace_id, key, val, created_by, created, modified_by, modified)
        VALUES ($1, $2, $3, $4, $5, $6, $7) 
        RETURNING *
        `,
        [setting.workspaceId, setting.key, val, username, created, username, created]
      );
      return mapRow(rows[0]);
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
    getSettingsByKey,
    getSetting,
    upsertSetting,
    deleteSettings,
  };
}
