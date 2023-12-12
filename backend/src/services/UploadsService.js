import omit from 'lodash.omit';

export function UploadsService({ pg, logger }) {

  function mapRow(row) {
    return {
      ...row.val,
      id: row.id,
      workspaceId: row.workspace_id,
      userId: row.user_id,
      filename: row.filename,
      created: row.created,
      createdBy: row.created_by,
      modified: row.modified,
      modifiedBy: row.modified_by,
    };
  }

  async function getAppUploads(workspaceId, appId) {
    if (workspaceId === null || typeof workspaceId === 'undefined') {
      return [];
    }
    if (appId === null || typeof appId === 'undefined') {
      return [];
    }
    let q = `
      SELECT id, workspace_id, user_id, filename, created, created_by, modified, modified_by, val
      FROM file_uploads
      WHERE workspace_id = $1 AND val->>'appId' = $2
      `;
    const { rows } = await pg.query(q, [workspaceId, appId]);
    if (rows.length === 0) {
      return [];
    }
    return rows.map(mapRow);
  }

  async function getUploads(workspaceId) {
    if (workspaceId === null || typeof workspaceId === 'undefined') {
      return [];
    }
    let q = `
      SELECT id, workspace_id, user_id, filename, created, created_by, modified, modified_by, val
      FROM file_uploads
      WHERE workspace_id = $1 AND (val->>'private')::boolean IS NOT TRUE
      `;
    const { rows } = await pg.query(q, [workspaceId]);
    if (rows.length === 0) {
      return [];
    }
    return rows.map(mapRow);
  }

  async function getUpload(id) {
    if (id === null || typeof id === 'undefined') {
      return null;
    }
    let q = `
      SELECT id, workspace_id, user_id, filename, created, created_by, modified, modified_by, val
      FROM file_uploads
      WHERE id = $1
      `;
    const { rows } = await pg.query(q, [id]);
    if (rows.length === 0) {
      return null;
    }
    return mapRow(rows[0]);
  }

  async function upsertUpload(upload, username) {
    if (upload === null || typeof upload === 'undefined') {
      return null;
    }
    const val = omit(upload, ['id', 'workspaceId', 'userId', 'filename']);
    const savedUpload = await getUpload(upload.id);
    if (savedUpload) {
      const modified = new Date();
      const { rows } = await pg.query(`
        UPDATE file_uploads
        SET val = $1, modified_by = $2, modified = $3
        WHERE id = $4
        RETURNING *
        `,
        [val, username, modified, upload.id]
      );
      return mapRow(rows[0]);
    } else {
      const created = new Date();
      const { rows } = await pg.query(`
        INSERT INTO file_uploads (workspace_id, user_id, filename, val, created_by, created, modified_by, modified)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
        `,
        [upload.workspaceId, username, upload.filename, val, username, created, username, created]
      );
      return mapRow(rows[0]);
    }
  }

  async function deleteUploads(ids) {
    if (ids === null || typeof ids === 'undefined') {
      return [];
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return [];
    }
    await pg.query(`
      DELETE FROM file_uploads WHERE id = ANY($1::INT[])
      `, [ids]);
    return ids;
  }

  async function deleteWorkspaceFiles(workspaceId, filenames) {
    if (filenames === null || typeof filenames === 'undefined') {
      return [];
    }
    if (!Array.isArray(filenames) || filenames.length === 0) {
      return [];
    }
    const { rows } = await pg.query(`
      DELETE FROM file_uploads WHERE workspace_id = $1 AND filename = ANY($2::VARCHAR[])
      RETURNING id
      `, [workspaceId, filenames]);
    return rows.map(r => r.id);
  }

  return {
    getAppUploads,
    getUploads,
    getUpload,
    upsertUpload,
    deleteUploads,
    deleteWorkspaceFiles,
  };
}
