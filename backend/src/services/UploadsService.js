import omit from 'lodash.omit';

export function UploadsService({ pg, logger }) {

  async function getUploads(workspaceId) {
    if (workspaceId === null || typeof workspaceId === 'undefined') {
      return [];
    }
    let q = `
      SELECT id, workspace_id, user_id, filename, created, created_by, modified, modified_by, val
      FROM file_uploads
      WHERE workspace_id = $1
      `;
    const { rows } = await pg.query(q, [workspaceId]);
    if (rows.length === 0) {
      return [];
    }
    const uploads = rows.map((row) => ({
      ...omit(row.val, ['data']),
      id: row.id,
      workspaceId: row.workspace_id,
      userId: row.user_id,
      filename: row.filename,
      created: row.created,
      createdBy: row.created_by,
      modified: row.modified,
      modifiedBy: row.modified_by,
    }));
    return uploads;
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
    const row = rows[0];
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

  async function upsertUpload(upload, username) {
    if (upload === null || typeof upload === 'undefined') {
      return null;
    }
    const val = omit(upload, ['id', 'workspaceId', 'userId', 'filename']);
    const savedUpload = await getUpload(upload.id);
    if (savedUpload) {
      await pg.query(`
        UPDATE file_uploads
        SET val = $1, modified_by = $2, modified = $3
        WHERE id = $4
        `,
        [val, username, new Date(), upload.id]
      );
      return { ...savedUpload, ...upload };
    } else {
      const created = new Date();
      const { rows } = await pg.query(`
        INSERT INTO file_uploads (workspace_id, user_id, filename, val, created_by, created, modified_by, modified)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id
        `,
        [upload.workspaceId, username, upload.filename, val, username, created, username, created]
      );
      return { ...upload, id: rows[0].id };
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
    await pg.query(`
      DELETE FROM file_uploads WHERE workspace_id = $1 AND filename = ANY($2::VARCHAR[])
      `, [workspaceId, filenames]);
    return filenames;
  }

  return {
    getUploads,
    getUpload,
    upsertUpload,
    deleteUploads,
    deleteWorkspaceFiles,
  };
}
