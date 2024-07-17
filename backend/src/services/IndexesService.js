import omit from 'lodash.omit';

export function IndexesService({ pg, logger }) {

  function mapRow(row) {
    return {
      ...row.val,
      id: row.id,
      workspaceId: row.workspace_id,
      name: row.name,
      vectorStoreProvider: row.engine,
      created: row.created,
      createdBy: row.created_by,
      modified: row.modified,
      modifiedBy: row.modified_by,
    };
  }

  async function getIndexesCount(workspaceId) {
    if (workspaceId === null || typeof workspaceId === 'undefined') {
      return -1;
    }
    let q = `
      WITH records_by_type AS (
        SELECT id
        , CASE WHEN engine <> '' THEN 'vectorIndex' ELSE 'graph' END AS index_type
        FROM doc_indexes
        WHERE workspace_id = $1 OR workspace_id = 1
        OR (val->>'isPublic')::boolean = true
      )
      SELECT index_type, COUNT(id) AS k
      FROM records_by_type
      GROUP BY index_type
    `;
    const { rows } = await pg.query(q, [workspaceId]);
    if (rows.length === 0) {
      return 0;
    }
    return rows.reduce((a, row) => {
      a[row.index_type] = row.k;
      return a;
    }, {});
  }

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
    return rows.map(mapRow);
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
      AND val->>'key' = $2
      `;
    const { rows } = await pg.query(q, [workspaceId, key]);
    if (rows.length === 0) {
      return null;
    }
    return mapRow(rows[0]);
  }

  async function getIndexByName(workspaceId, name) {
    if (workspaceId === null || typeof workspaceId === 'undefined') {
      return null;
    }
    if (name === null || typeof name === 'undefined') {
      return null;
    }
    let q = `
      SELECT id, workspace_id, name, engine, created, created_by, modified, modified_by, val
      FROM doc_indexes
      WHERE workspace_id = $1
      AND name = $2
      `;
    const { rows } = await pg.query(q, [workspaceId, name]);
    if (rows.length === 0) {
      return null;
    }
    return mapRow(rows[0]);
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
    return mapRow(rows[0]);
  }

  async function upsertIndex(index, username, partial) {
    if (index === null || typeof index === 'undefined') {
      return null;
    }
    const omittedFields = ['id', 'workspaceId', 'name', 'vectorStoreProvider', 'created', 'createdBy', 'modified', 'modifiedBy'];
    const savedIndex = await getIndex(index.id);
    if (savedIndex) {
      if (partial) {
        index = { ...savedIndex, ...index };
      }
      const val = omit(index, omittedFields);
      const modified = new Date();
      const { rows } = await pg.query(`
        UPDATE doc_indexes
        SET name = $1, engine = $2, val = $3, modified_by = $4, modified = $5
        WHERE id = $6
        RETURNING *
        `,
        [index.name, index.vectorStoreProvider, val, username, modified, index.id]
      );
      return mapRow(rows[0]);

    } else {
      const val = omit(index, omittedFields);
      const created = new Date();
      const { rows } = await pg.query(`
        INSERT INTO doc_indexes (workspace_id, name, engine, val, created_by, created, modified_by, modified)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
        `,
        [index.workspaceId, index.name, index.vectorStoreProvider, val, username, created, username, created]
      );
      return mapRow(rows[0]);
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
    getIndexesCount,
    getIndexes,
    getIndexByKey,
    getIndexByName,
    getIndex,
    upsertIndex,
    deleteIndexes,
  };
}
