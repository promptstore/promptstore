const omit = require('lodash.omit');

function UploadsService({ pg, logger }) {

  async function getUploads(workspaceId) {
    let q = `
      SELECT id, workspace_id, filename, val
      FROM file_uploads
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
    const uploads = rows.map((row) => ({
      ...omit(row.val, ['data']),
      id: row.id,
      workspaceId: row.workspace_id,
      filename: row.filename,
    }));
    return uploads;
  }

  async function getUpload(id) {
    if (id === null || typeof id === 'undefined') {
      return null;
    }
    let q = `
      SELECT id, workspace_id, filename, val
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
      filename: row.filename,
    };
  }

  async function upsertUpload(upload) {
    if (upload === null || typeof upload === 'undefined') {
      return null;
    }
    const val = omit(upload, ['id', 'workspaceId', 'filename']);
    const savedUpload = await getUpload(upload.id);
    if (savedUpload) {
      await pg.query(`
        UPDATE file_uploads
        SET val = $1
        WHERE id = $2
        `,
        [val, upload.id]
      );
      return upload;
    } else {
      const { rows } = await pg.query(`
        INSERT INTO file_uploads (workspace_id, filename, val)
        VALUES ($1, $2, $3) RETURNING id
        `,
        [upload.workspaceId, upload.filename, val]
      );
      return rows[0].id;
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

module.exports = {
  UploadsService,
};
