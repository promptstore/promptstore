const omit = require('lodash.omit');

function IndexesService({ pg, logger }) {

  async function getIndexes() {
    let q = `
      SELECT id, workspace_id, name, engine, created, created_by, modified, modified_by, val
      FROM doc_indexes
      `;
    const { rows } = await pg.query(q);
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

  async function getIndexByKey(key) {
    if (key === null || typeof key === 'undefined') {
      return null;
    }
    let q = `
      SELECT id, workspace_id, name, engine, created, created_by, modified, modified_by, val
      FROM doc_indexes
      WHERE val->>'key' = $1
      `;
    const { rows } = await pg.query(q, [key]);
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

  async function upsertIndex(index) {
    if (index === null || typeof index === 'undefined') {
      return null;
    }
    const val = omit(index, ['id', 'workspace_id', 'name', 'engine', 'created', 'createdBy', 'modified', 'modifiedBy']);
    const savedIndex = await getIndex(index.id);
    if (savedIndex) {
      await pg.query(`
        UPDATE doc_indexes
        SET name = $1, engine = $2, val = $3
        WHERE id = $4
        `,
        [index.name, index.engine, val, index.id]
      );
      return index.id;
    } else {
      const { rows } = await pg.query(`
        INSERT INTO doc_indexes (name, engine, val)
        VALUES ($1, $2, $3) RETURNING id
        `,
        [index.name, index.engine, val]
      );
      return rows[0].id;
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

module.exports = {
  IndexesService,
};
