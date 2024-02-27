import omit from 'lodash.omit';

export function MirrorsService({ pg, logger }) {

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

  async function getMirrors() {
    let q = `
      SELECT id, workspace_id, name, created, created_by, modified, modified_by, val
      FROM mirrors
      `;
    const { rows } = await pg.query(q);
    if (rows.length === 0) {
      return [];
    }
    return rows.map(mapRow);
  }

  async function getMirror(id) {
    if (id === null || typeof id === 'undefined') {
      return null;
    }
    let q = `
      SELECT id, workspace_id, name, created, created_by, modified, modified_by, val
      FROM mirrors
      WHERE id = $1
      `;
    const { rows } = await pg.query(q, [id]);
    if (rows.length === 0) {
      return null;
    }
    return mapRow(rows[0]);
  }

  async function upsertMirror(mirror, username) {
    if (mirror === null || typeof mirror === 'undefined') {
      return null;
    }
    const omittedFields = ['id', 'workspaceId', 'name', 'created', 'createdBy', 'modified', 'modifiedBy'];
    const savedMirror = await getMirror(mirror.id);
    if (savedMirror) {
      mirror = { ...savedMirror, ...mirror };
      const val = omit(mirror, omittedFields);
      const modified = new Date();
      const { rows } = await pg.query(`
        UPDATE mirrors
        SET name = $1, val = $2, modified_by = $3, modified = $4
        WHERE id = $5
        RETURNING *
        `,
        [mirror.name, val, username, modified, mirror.id]
      );
      return mapRow(rows[0]);
    } else {
      const val = omit(mirror, omittedFields);
      const created = new Date();
      const { rows } = await pg.query(`
        INSERT INTO mirrors (workspace_id, name, val, created_by, created, modified_by, modified)
        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
        `,
        [mirror.workspaceId, mirror.name, val, username, created, username, created]
      );
      return mapRow(rows[0]);
    }
  }

  async function deleteMirrors(ids) {
    if (ids === null || typeof ids === 'undefined') {
      return [];
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return [];
    }
    await pg.query(`
      DELETE FROM mirrors WHERE id = ANY($1::INT[])
      `, [ids]);
    return ids;
  }

  return {
    getMirrors,
    getMirror,
    upsertMirror,
    deleteMirrors,
  };
}
