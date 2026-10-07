import omit from 'lodash.omit';

export function McpServersService({ pg, logger }) {

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

  async function getMcpServers(workspaceId) {
    if (workspaceId === null || typeof workspaceId === 'undefined') {
      return [];
    }
    let q = `
      SELECT id, workspace_id, name, created, created_by, modified, modified_by, val
      FROM mcp_servers
      WHERE workspace_id = $1
      ORDER BY name
      `;
    const { rows } = await pg.query(q, [workspaceId]);
    return rows.map(mapRow);
  }

  async function getMcpServer(id) {
    if (id === null || typeof id === 'undefined') {
      return null;
    }
    let q = `
      SELECT id, workspace_id, name, created, created_by, modified, modified_by, val
      FROM mcp_servers
      WHERE id = $1
      `;
    const { rows } = await pg.query(q, [id]);
    if (rows.length === 0) {
      return null;
    }
    return mapRow(rows[0]);
  }

  async function upsertMcpServer(server, username) {
    if (server === null || typeof server === 'undefined') {
      return null;
    }
    const omittedFields = ['id', 'workspaceId', 'name', 'created', 'createdBy', 'modified', 'modifiedBy'];
    const val = omit(server, omittedFields);
    const saved = server.id ? await getMcpServer(server.id) : null;
    if (saved) {
      const { rows } = await pg.query(`
        UPDATE mcp_servers
        SET name = $1, val = $2, modified_by = $3, modified = $4
        WHERE id = $5
        RETURNING *
        `,
        [server.name, val, username, new Date(), server.id]
      );
      return mapRow(rows[0]);
    }
    const created = new Date();
    const { rows } = await pg.query(`
      INSERT INTO mcp_servers (workspace_id, name, val, created_by, created, modified_by, modified)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
      `,
      [server.workspaceId, server.name, val, username, created, username, created]
    );
    return mapRow(rows[0]);
  }

  async function deleteMcpServers(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      return [];
    }
    await pg.query('DELETE FROM mcp_servers WHERE id = ANY($1::INT[])', [ids]);
    return ids;
  }

  return {
    getMcpServers,
    getMcpServer,
    upsertMcpServer,
    deleteMcpServers,
  };
}
