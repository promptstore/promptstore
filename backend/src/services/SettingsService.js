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
      WHERE workspace_id = $1
      `;
    // const { rows } = await pg.query(q, [-1]);  // system wide
    const { rows } = await pg.query(q, [workspaceId]);
    if (rows.length === 0) {
      return [];
    }
    return rows.map(mapRow);
  }

  async function getSettingsByKeys(workspaceId, keys) {
    let q = `
      SELECT id, workspace_id, key, created, created_by, modified, modified_by, val
      FROM settings
      WHERE workspace_id = $1
      AND key = ANY($2::VARCHAR[])
      `;
    // const { rows } = await pg.query(q, [-1, keys]);  // system wide
    const { rows } = await pg.query(q, [workspaceId, keys]);
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
      WHERE workspace_id = $1
      AND key = $2
      `;
    // const { rows } = await pg.query(q, [-1, key]);  // system wide
    const { rows } = await pg.query(q, [workspaceId, key]);
    if (rows.length === 0) {
      return [];
    }
    return rows.map(mapRow);
  }

  async function getSettingsByName(workspaceId, name) {
    let q = `
      SELECT id, workspace_id, key, created, created_by, modified, modified_by, val
      FROM settings
      WHERE workspace_id = $1
      AND val->>'name' LIKE $2 || '%'
      `;
    // const { rows } = await pg.query(q, [-1, name]);  // system wide
    const { rows } = await pg.query(q, [workspaceId, name]);
    if (rows.length === 0) {
      return [];
    }
    return rows.map(mapRow);
  }

  async function getSettingsByTags(workspaceId, tags, all) {
    logger.debug('get settings by tags:', tags, all ? 'all' : 'any');
    if (tags === null || typeof tags === 'undefined') {
      return null;
    }
    let q;
    // const values = [-1];  // system wide
    const values = [workspaceId];
    if (all) {
      q = `
        SELECT id, workspace_id, key, created, created_by, modified, modified_by, val
        FROM settings s
        WHERE workspace_id = $1
        `;
      let i = 2;
      for (const tag of tags) {
        q += ` AND (s.val->'tags')::jsonb ? $${i}`;
        values.push(tag);
        i += 1;
      }
    } else {
      q = `
        SELECT id, workspace_id, key, created, created_by, modified, modified_by, val
        FROM settings s, json_array_elements_text(s.val->'tags') tag
        WHERE workspace_id = $1 AND tag = ANY($2::VARCHAR[])
        `;
      values.push(tags);
    }
    const { rows } = await pg.query(q, values);
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

  async function upsertSetting(setting, username, partial) {
    if (setting === null || typeof setting === 'undefined') {
      return null;
    }
    const omittedFields = ['id', 'workspaceId', 'key', 'created', 'createdBy', 'modified', 'modifiedBy'];
    const savedSetting = await getSetting(setting.id);
    if (savedSetting) {
      if (partial) {
        setting = { ...savedSetting, ...setting };
      }
      const val = omit(setting, omittedFields);
      const modified = new Date();
      const { rows } = await pg.query(`
        UPDATE settings
        SET key = $1, val = $2, modified_by = $3, modified = $4
        WHERE id = $5
        RETURNING *
        `,
        [setting.key, val, username, modified, setting.id]
      );
      return mapRow(rows[0]);

    } else {
      const created = new Date();
      const val = omit(setting, omittedFields);
      const { rows } = await pg.query(`
        INSERT INTO settings (workspace_id, key, val, created_by, created, modified_by, modified)
        VALUES ($1, $2, $3, $4, $5, $6, $7) 
        RETURNING *
        `,
        // [-1, setting.key, val, username, created, username, created]  // system wide
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

  async function deleteSettingsByWorkspace(workspaceId) {
    logger.debug('delete settings by workspace:', workspaceId);
    await pg.query(`
      DELETE FROM settings WHERE workspace_id = $1
      `, [workspaceId]);
    return workspaceId;
  }

  return {
    getSettings,
    getSettingsByKeys,
    getSettingsByKey,
    getSettingsByName,
    getSettingsByTags,
    getSetting,
    upsertSetting,
    deleteSettings,
    deleteSettingsByWorkspace,
  };
}
