import omit from 'lodash.omit';

export function IndexesService({ pg, logger }) {

  async function getIndexes(workspaceId) {
    if (workspaceId === null || typeof workspaceId === 'undefined') {
      return [];
    }
    let q = `
      SELECT id, workspace_id, name, engine, created, created_by, modified, modified_by, val
      FROM doc_indexes
      WHERE workspace_id = $1
      `;
    const { rows } = await pg.query(q, [workspaceId]);
    if (rows.length === 0) {
      return [];
    }
    const indexes = rows.map((row) => ({
      ...row.val,
      id: row.id,
      workspaceId: row.workspace_id,
      name: row.name,
      engine: row.engine,
      created: row.created,
      createdBy: row.created_by,
      modified: row.modified,
      modifiedBy: row.modified_by,
    }));
    return indexes;
  }

  async function getIndexByKey(workspaceId, key) {
    if (workspaceId === null || typeof workspaceId === 'undefined') {
      return null;
    }
    if (key === null || typeof key === 'undefined') {
      return null;
    }
    let q = `
      SELECT id, workspace_id, name, engine, created, created_by, modified, modified_by, val
      FROM doc_indexes
      WHERE workspace_id = $1
      AND val->>'key' = $1
      `;
    const { rows } = await pg.query(q, [workspaceId, key]);
    if (rows.length === 0) {
      return null;
    }
    const row = rows[0];
    return {
      ...row.val,
      id: row.id,
      workspaceId: row.workspace_id,
      name: row.name,
      engine: row.engine,
      created: row.created,
      createdBy: row.created_by,
      modified: row.modified,
      modifiedBy: row.modified_by,
    };
  }

  async function getIndex(id) {
    if (id === null || typeof id === 'undefined') {
      return null;
    }
    let q = `
      SELECT id, workspace_id, name, engine, created, created_by, modified, modified_by, val
      FROM doc_indexes
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
      engine: row.engine,
      created: row.created,
      createdBy: row.created_by,
      modified: row.modified,
      modifiedBy: row.modified_by,
    };
  }

  async function upsertIndex(index, username) {
    if (index === null || typeof index === 'undefined') {
      return null;
    }
    const val = omit(index, ['id', 'workspaceId', 'name', 'engine', 'created', 'createdBy', 'modified', 'modifiedBy']);
    const savedIndex = await getIndex(index.id);
    if (savedIndex) {
      await pg.query(`
        UPDATE doc_indexes
        SET name = $1, engine = $2, val = $3, modified_by = $4, modified = $5
        WHERE id = $6
        `,
        [index.name, index.engine, val, username, new Date(), index.id]
      );
      return { ...savedIndex, ...index };
    } else {
      const created = new Date();
      const { rows } = await pg.query(`
        INSERT INTO doc_indexes (workspace_id, name, engine, val, created_by, created, modified_by, modified)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id
        `,
        [index.workspaceId, index.name, index.engine, val, username, created, username, created]
      );
      return { ...index, id: rows[0].id };
    }
  }

  async function deleteIndexes(ids) {
    if (ids === null || typeof ids === 'undefined') {
      return [];
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return [];
    }
    await pg.query(`
      DELETE FROM doc_indexes WHERE id = ANY($1::INT[])
      `, [ids]);
    return ids;
  }

  return {
    getIndexes,
    getIndexByKey,
    getIndex,
    upsertIndex,
    deleteIndexes,
  };
}