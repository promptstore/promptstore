const omit = require('lodash.omit');

function DataSourcesService({ pg, logger }) {

  async function getDataSources() {
    let q = `
      SELECT id, name, type, created, created_by, modified, modified_by, val
      FROM data_sources
      `;
    const { rows } = await pg.query(q);
    if (rows.length === 0) {
      return [];
    }
    const dataSources = rows.map((row) => ({
      ...row.val,
      id: row.id,
      name: row.name,
      type: row.type,
      created: row.created,
      createdBy: row.created_by,
      modified: row.modified,
      modifiedBy: row.modified_by,
    }));
    return dataSources;
  }

  async function getDataSourcesByType(type) {
    if (type === null || typeof type === 'undefined') {
      return null;
    }
    let q = `
      SELECT id, name, type, created, created_by, modified, modified_by, val
      FROM data_sources
      WHERE type = $1
      `;
    const { rows } = await pg.query(q, [type]);
    if (rows.length === 0) {
      return null;
    }
    const dataSources = rows.map((row) => ({
      ...row.val,
      id: row.id,
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
      SELECT id, name, type, created, created_by, modified, modified_by, val
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
      name: row.name,
      type: row.type,
      created: row.created,
      createdBy: row.created_by,
      modified: row.modified,
      modifiedBy: row.modified_by,
    };
  }

  async function upsertDataSource(dataSource) {
    if (dataSource === null || typeof dataSource === 'undefined') {
      return null;
    }
    const val = omit(dataSource, ['id', 'name', 'type', 'created', 'createdBy', 'modified', 'modifiedBy']);
    const savedDataSource = await getDataSource(dataSource.id);
    if (savedDataSource) {
      await pg.query(`
        UPDATE data_sources
        SET name = $1, type = $2, val = $3
        WHERE id = $4
        `,
        [dataSource.name, dataSource.type, val, dataSource.id]
      );
      return dataSource.id;
    } else {
      const { rows } = await pg.query(`
        INSERT INTO data_sources (name, type, val)
        VALUES ($1, $2, $3) RETURNING id
        `,
        [dataSource.name, dataSource.type, val]
      );
      return rows[0].id;
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

module.exports = {
  DataSourcesService,
};
