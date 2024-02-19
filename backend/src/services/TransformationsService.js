import omit from 'lodash.omit';

export function TransformationsService({ pg, logger }) {

  function mapRow(row) {
    return {
      ...row.val,
      id: row.id,
      name: row.name,
      workspaceId: row.workspace_id,
      dataSourceId: row.data_source_id,
      created: row.created,
      createdBy: row.created_by,
      modified: row.modified,
      modifiedBy: row.modified_by,
    };
  }

  async function getTransformations(workspaceId) {
    if (workspaceId === null || typeof workspaceId === 'undefined') {
      return [];
    }
    let q = `
      SELECT id, workspace_id, data_source_id, name, created, created_by, modified, modified_by, val
      FROM transformations
      WHERE workspace_id = $1
      ORDER BY created DESC
      LIMIT 100
      `;
    const { rows } = await pg.query(q, [workspaceId]);
    if (rows.length === 0) {
      return [];
    }
    return rows.map(mapRow);
  }

  async function getTransformation(id) {
    if (id === null || typeof id === 'undefined') {
      return null;
    }
    let q = `
      SELECT id, workspace_id, data_source_id, name, created, created_by, modified, modified_by, val
      FROM transformations
      WHERE id = $1
      `;
    const { rows } = await pg.query(q, [id]);
    if (rows.length === 0) {
      return null;
    }
    return mapRow(rows[0]);
  }

  async function upsertTransformation(transformation, username) {
    if (transformation === null || typeof transformation === 'undefined') {
      return null;
    }
    const omittedFields = ['id', 'workspaceId', 'dataSourceId', 'name', 'created', 'createdBy', 'modified', 'modifiedBy'];
    const savedTransformation = await getTransformation(transformation.id);
    if (savedTransformation) {
      transformation = { ...savedTransformation, ...transformation };
      const val = omit(transformation, omittedFields);
      const modified = new Date();
      const { rows } = await pg.query(`
        UPDATE transformations
        SET name = $1, data_source_id = $2, val = $3, modified_by = $4, modified = $5
        WHERE id = $6
        RETURNING *
        `,
        [transformation.name, transformation.dataSourceId, val, transformation.id, modified, transformation.id]
      );
      return mapRow(rows[0]);

    } else {
      const val = omit(transformation, omittedFields);
      const created = new Date();
      const { rows } = await pg.query(`
        INSERT INTO transformations (workspace_id, data_source_id, name, val, created_by, created, modified_by, modified)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
        `,
        [transformation.workspaceId, transformation.dataSourceId, transformation.name, val, username, created, username, created]
      );
      return mapRow(rows[0]);
    }
  }

  async function deleteTransformations(ids) {
    if (ids === null || typeof ids === 'undefined') {
      return [];
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return [];
    }
    await pg.query(`
      DELETE FROM transformations WHERE id = ANY($1::INT[])
      `, [ids]);
    return ids;
  }

  return {
    getTransformations,
    getTransformation,
    upsertTransformation,
    deleteTransformations,
  };
}
