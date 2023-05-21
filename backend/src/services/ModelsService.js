const omit = require('lodash.omit');

function ModelsService({ pg, logger }) {

  async function getModels() {
    let q = `
      SELECT id, name, created, created_by, modified, modified_by, val
      FROM models
      `;
    const { rows } = await pg.query(q);
    if (rows.length === 0) {
      return [];
    }
    const models = rows.map((row) => ({
      ...row.val,
      id: row.id,
      name: row.name,
      created: row.created,
      createdBy: row.created_by,
      modified: row.modified,
      modifiedBy: row.modified_by,
    }));
    return models;
  }

  async function getModelByKey(key) {
    if (key === null || typeof key === 'undefined') {
      return null;
    }
    let q = `
      SELECT id, name, created, created_by, modified, modified_by, val
      FROM models
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
      name: row.name,
      created: row.created,
      createdBy: row.created_by,
      modified: row.modified,
      modifiedBy: row.modified_by,
    };
  }

  async function getModelByName(name) {
    if (name === null || typeof name === 'undefined') {
      return null;
    }
    let q = `
      SELECT id, name, created, created_by, modified, modified_by, val
      FROM models
      WHERE name = $1
      `;
    const { rows } = await pg.query(q, [name]);
    if (rows.length === 0) {
      return null;
    }
    const row = rows[0];
    return {
      ...row.val,
      id: row.id,
      name: row.name,
      created: row.created,
      createdBy: row.created_by,
      modified: row.modified,
      modifiedBy: row.modified_by,
    };
  }

  async function getModel(id) {
    if (id === null || typeof id === 'undefined') {
      return null;
    }
    let q = `
      SELECT id, name, created, created_by, modified, modified_by, val
      FROM models
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
      created: row.created,
      createdBy: row.created_by,
      modified: row.modified,
      modifiedBy: row.modified_by,
    };
  }

  async function upsertModel(func) {
    if (func === null || typeof func === 'undefined') {
      return null;
    }
    const val = omit(func, ['id', 'name', 'created', 'createdBy', 'modified', 'modifiedBy']);
    const savedModel = await getModel(func.id);
    if (savedModel) {
      await pg.query(`
        UPDATE models
        SET name = $1, val = $2
        WHERE id = $3
        `,
        [func.name, val, func.id]
      );
      return func.id;
    } else {
      const { rows } = await pg.query(`
        INSERT INTO models (name, val)
        VALUES ($1, $2) RETURNING id
        `,
        [func.name, val]
      );
      return rows[0].id;
    }
  }

  async function deleteModels(ids) {
    if (ids === null || typeof ids === 'undefined') {
      return [];
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return [];
    }
    await pg.query(`
      DELETE FROM models WHERE id = ANY($1::INT[])
      `, [ids]);
    return ids;
  }

  return {
    getModels,
    getModelByKey,
    getModelByName,
    getModel,
    upsertModel,
    deleteModels,
  };
}

module.exports = {
  ModelsService,
};
