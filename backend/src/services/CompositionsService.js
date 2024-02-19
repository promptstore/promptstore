import omit from 'lodash.omit';

export function CompositionsService({ pg, logger }) {

  function mapRow(row) {
    return {
      ...row.val,
      id: row.id,
      name: row.name,
      workspaceId: row.workspace_id,
      created: row.created,
      createdBy: row.created_by,
      modified: row.modified,
      modifiedBy: row.modified_by,
    };
  }

  async function getCompositions(workspaceId) {
    if (workspaceId === null || typeof workspaceId === 'undefined') {
      return [];
    }
    let q = `
      SELECT id, workspace_id, name, created, created_by, modified, modified_by, val
      FROM compositions
      WHERE workspace_id = $1
      `;
    const { rows } = await pg.query(q, [workspaceId]);
    if (rows.length === 0) {
      return [];
    }
    return rows.map(mapRow);
  }

  async function getCompositionsByName(workspaceId, name) {
    if (workspaceId === null || typeof workspaceId === 'undefined') {
      return [];
    }
    if (name === null || typeof name === 'undefined') {
      return [];
    }
    let q = `
      SELECT id, workspace_id, name, created, created_by, modified, modified_by, val
      FROM compositions
      WHERE (workspace_id = $1 OR workspace_id = 1 OR (val->>'isPublic')::boolean = true)
      AND name LIKE $2 || '%'
      `;
    const { rows } = await pg.query(q, [workspaceId, name]);
    if (rows.length === 0) {
      return [];
    }
    return rows.map(mapRow);
  }

  async function getCompositionByName(workspaceId, name) {
    if (workspaceId === null || typeof workspaceId === 'undefined') {
      return null;
    }
    if (name === null || typeof name === 'undefined') {
      return null;
    }
    let q = `
      SELECT id, workspace_id, name, created, created_by, modified, modified_by, val
      FROM compositions
      WHERE workspace_id = $1
      AND name = $2
      `;
    const { rows } = await pg.query(q, [workspaceId, name]);
    if (rows.length === 0) {
      return null;
    }
    return mapRow(rows[0]);
  }

  async function getComposition(id) {
    if (id === null || typeof id === 'undefined') {
      return null;
    }
    let q = `
      SELECT id, workspace_id, name, created, created_by, modified, modified_by, val
      FROM compositions
      WHERE id = $1
      `;
    const { rows } = await pg.query(q, [id]);
    if (rows.length === 0) {
      return null;
    }
    return mapRow(rows[0]);
  }

  async function upsertComposition(composition, username) {
    if (composition === null || typeof composition === 'undefined') {
      return null;
    }
    const omittedFields = ['id', 'workspaceId', 'name', 'created', 'createdBy', 'modified', 'modifiedBy'];
    const savedComposition = await getComposition(composition.id);
    if (savedComposition) {
      composition = { ...savedComposition, ...composition };
      const val = omit(composition, omittedFields);
      const modified = new Date();
      const { rows } = await pg.query(`
        UPDATE compositions
        SET name = $1, val = $2, modified_by = $3, modified = $4
        WHERE id = $5
        RETURNING *
        `,
        [composition.name, val, username, modified, composition.id]
      );
      return mapRow(rows[0]);

    } else {
      const val = omit(composition, omittedFields);
      const created = new Date();
      const { rows } = await pg.query(`
        INSERT INTO compositions (workspace_id, name, val, created_by, created, modified_by, modified)
        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
        `,
        [composition.workspaceId, composition.name, val, username, created, username, created]
      );
      return mapRow(rows[0]);
    }
  }

  async function deleteCompositions(ids) {
    if (ids === null || typeof ids === 'undefined') {
      return [];
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return [];
    }
    await pg.query(`
      DELETE FROM compositions WHERE id = ANY($1::INT[])
      `, [ids]);
    return ids;
  }

  return {
    getCompositions,
    getCompositionsByName,
    getCompositionByName,
    getComposition,
    upsertComposition,
    deleteCompositions,
  };
}
