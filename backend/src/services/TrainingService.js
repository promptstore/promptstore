import omit from 'lodash.omit';

export function TrainingService({ pg, logger }) {

  function mapRow(row) {
    return {
      ...row.val,
      id: row.id,
      workspaceId: row.workspace_id,
      contentId: row.content_id,
      prompt: row.prompt,
      response: row.response,
      created: row.created,
      createdBy: row.created_by,
      modified: row.modified,
      modifiedBy: row.modified_by,
    };
  }

  async function getTrainingData(workspaceId, limit = 999, start = 0) {
    let q = `
      SELECT id, workspace_id, content_id, prompt, response, created, created_by, modified, modified_by, val
      FROM training
      WHERE workspace_id = $1
      LIMIT $2 OFFSET $3
      `;
    const { rows } = await pg.query(q, [workspaceId, limit, start]);
    return rows.map(mapRow);
  }

  async function getTrainingRow(id) {
    if (id === null || typeof id === 'undefined') {
      return null;
    }
    let q = `
      SELECT id, workspace_id, content_id, prompt, response, created, created_by, modified, modified_by, val
      FROM training
      WHERE id = $1
      `;
    const { rows } = await pg.query(q, [id]);
    if (rows.length === 0) {
      return null;
    }
    return mapRow(rows[0]);
  }

  async function upsertTrainingRow(row) {
    const val = omit(row, ['id', 'workspaceId', 'contentId', 'prompt', 'response', 'created', 'createdBy', 'modified', 'modifiedBy']);
    const savedRow = await getTrainingRow(row.id);
    if (savedRow) {
      await pg.query(`
        UPDATE training
        SET prompt = $1, response = $2, val = $3
        WHERE id = $4
        `,
        [row.prompt, row.response, val, row.id]
      );
      return row.id;
    } else {
      const { rows } = await pg.query(`
        INSERT INTO training (workspace_id, content_id, prompt, response, val)
        VALUES ($1, $2, $3, $4, $5) RETURNING id
        `,
        [row.workspace_id, row.contentId, row.prompt, row.response, val]
      );
      return rows[0].id;
    }
  }

  async function deleteTrainingRows(ids) {
    await pg.query(`
      DELETE FROM training WHERE id = ANY($1::INT[])
      `, [ids]);
    return ids;
  }

  async function deleteTrainingRowByContentId(contentId) {
    const { rows } = await pg.query(`
      DELETE FROM training WHERE content_id = $1 RETURNING id
      `, [contentId]);
    return rows.map((row) => row.id);
  }

  return {
    deleteTrainingRowByContentId,
    deleteTrainingRows,
    getTrainingData,
    getTrainingRow,
    upsertTrainingRow,
  };
}
