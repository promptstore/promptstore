import omit from 'lodash.omit';

export function DestinationsService({ pg, logger }) {

  function mapRow(row) {
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

  async function getDestinations(workspaceId) {
    if (workspaceId === null || typeof workspaceId === 'undefined') {
      return [];
    }
    let q = `
      SELECT id, workspace_id, name, type, created, created_by, modified, modified_by, val
      FROM destinations
      WHERE workspace_id = $1
      `;
    const { rows } = await pg.query(q, [workspaceId]);
    if (rows.length === 0) {
      return [];
    }
    return rows.map(mapRow);
  }

  async function getDestinationsByType(workspaceId, type) {
    if (workspaceId === null || typeof workspaceId === 'undefined') {
      return [];
    }
    if (type === null || typeof type === 'undefined') {
      return [];
    }
    let q = `
      SELECT id, workspace_id, name, type, created, created_by, modified, modified_by, val
      FROM destinations
      WHERE workspace_id = $1
      AND type = $2
      `;
    const { rows } = await pg.query(q, [workspaceId, type]);
    if (rows.length === 0) {
      return [];
    }
    return rows.map(mapRow);
  }

  async function getDestination(id) {
    if (id === null || typeof id === 'undefined') {
      return null;
    }
    let q = `
      SELECT id, workspace_id, name, type, created, created_by, modified, modified_by, val
      FROM destinations
      WHERE id = $1
      `;
    const { rows } = await pg.query(q, [id]);
    if (rows.length === 0) {
      return null;
    }
    return mapRow(rows[0]);
  }

  async function upsertDestination(destination, username) {
    if (destination === null || typeof destination === 'undefined') {
      return null;
    }
    const omittedFields = ['id', 'workspaceId', 'name', 'type', 'created', 'createdBy', 'modified', 'modifiedBy'];
    const savedDestination = await getDestination(destination.id);
    if (savedDestination) {
      destination = { ...savedDestination, ...destination };
      const val = omit(destination, omittedFields);
      const modified = new Date();
      const { rows } = await pg.query(`
        UPDATE destinations
        SET name = $1, type = $2, val = $3, modified_by = $4, modified = $5
        WHERE id = $6
        RETURNING *
        `,
        [destination.name, destination.type, val, username, modified, destination.id]
      );
      return mapRow(rows[0]);

    } else {
      const val = omit(destination, omittedFields);
      const created = new Date();
      const { rows } = await pg.query(`
        INSERT INTO destinations (workspace_id, name, type, val, created_by, created, modified_by, modified)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
        `,
        [destination.workspaceId, destination.name, destination.type, val, username, created, username, created]
      );
      return mapRow(rows[0]);
    }
  }

  async function deleteDestinations(ids) {
    if (ids === null || typeof ids === 'undefined') {
      return [];
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return [];
    }
    await pg.query(`
      DELETE FROM destinations WHERE id = ANY($1::INT[])
      `, [ids]);
    return ids;
  }

  return {
    getDestinations,
    getDestinationsByType,
    getDestination,
    upsertDestination,
    deleteDestinations,
  };
}
