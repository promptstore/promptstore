import omit from 'lodash.omit';

export function DataSourcesService({ pg, logger }) {

  async function getDataSources(workspaceId) {
    if (workspaceId === null || typeof workspaceId === 'undefined') {
      return [];
    }
    let q = `
      SELECT id, workspace_id, name, type, created, created_by, modified, modified_by, val
      FROM data_sources
      WHERE workspace_id = $1
      `;
    const { rows } = await pg.query(q, [workspaceId]);
    if (rows.length === 0) {
      return [];
    }
    const dataSources = rows.map((row) => ({
      ...row.val,
      id: row.id,
      workspaceId: row.workspace_id,
      name: row.name,
      type: row.type,
      created: row.created,
      createdBy: row.created_by,
      modified: row.modified,
      modifiedBy: row.modified_by,
    }));
    return dataSources;
  }

  async function getDataSourcesByType(workspaceId, type) {
    if (workspaceId === null || typeof workspaceId === 'undefined') {
      return [];
    }
    if (type === null || typeof type === 'undefined') {
      return [];
    }
    let q = `
      SELECT id, workspace_id, name, type, created, created_by, modified, modified_by, val
      FROM data_sources
      WHERE workspace_id = $1
      AND type = $2
      `;
    const { rows } = await pg.query(q, [workspaceId, type]);
    if (rows.length === 0) {
      return [];
    }
    const dataSources = rows.map((row) => ({
      ...row.val,
      id: row.id,
      workspaceId: row.workspace_id,
      name: row.name,
      type: row.type,
      created: row.created,
      createdBy: row.created_by,
      modified: row.modified,
      modifiedBy: row.modified_by,
    }));
    return dataSources;
  }

  async function getDataSource(id) {
    if (id === null || typeof id === 'undefined') {
      return null;
    }
    let q = `
      SELECT id, workspace_id, name, type, created, created_by, modified, modified_by, val
      FROM data_sources
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
      type: row.type,
      created: row.created,
      createdBy: row.created_by,
      modified: row.modified,
      modifiedBy: row.modified_by,
    };
  }

  async function upsertDataSource(dataSource, username) {
    if (dataSource === null || typeof dataSource === 'undefined') {
      return null;
    }
    const val = omit(dataSource, ['id', 'workspaceId', 'name', 'type', 'created', 'createdBy', 'modified', 'modifiedBy']);
    const savedDataSource = await getDataSource(dataSource.id);
    if (savedDataSource) {
      await pg.query(`
        UPDATE data_sources
        SET name = $1, type = $2, val = $3, modified_by = $4, modified = $5
        WHERE id = $6
        `,
        [dataSource.name, dataSource.type, val, username, new Date(), dataSource.id]
      );
      return { ...savedDataSource, ...dataSource };
    } else {
      const created = new Date();
      const { rows } = await pg.query(`
        INSERT INTO data_sources (workspace_id, name, type, val, created_by, created, modified_by, modified)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id
        `,
        [dataSource.workspaceId, dataSource.name, dataSource.type, val, username, created, username, created]
      );
      return { ...dataSource, id: rows[0].id };
    }
  }

  async function deleteDataSources(ids) {
    if (ids === null || typeof ids === 'undefined') {
      return [];
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return [];
    }
    await pg.query(`
      DELETE FROM data_sources WHERE id = ANY($1::INT[])
      `, [ids]);
    return ids;
  }

  return {
    getDataSources,
    getDataSourcesByType,
    getDataSource,
    upsertDataSource,
    deleteDataSources,
  };
}