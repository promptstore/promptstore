import omit from 'lodash.omit';

export function AgentNetworksService({ pg, logger }) {

  function mapRow(row) {
    return {
      ...row.val,
      id: row.id,
      workspaceId: row.workspace_id,
      name: row.name,
      created: row.created,
      createdBy: row.created_by,
      modified: row.modified,
      modifiedBy: row.modified_by,
    };
  }

  async function getAgentNetworksCount(workspaceId) {
    if (workspaceId === null || typeof workspaceId === 'undefined') {
      return -1;
    }
    let q = `
      SELECT COUNT(id) AS k
      FROM agent_networks
      WHERE workspace_id = $1
      `;
    const { rows } = await pg.query(q, [workspaceId]);
    if (rows.length === 0) {
      return 0;
    }
    return rows[0].k;
  }

  async function getAgentNetworks(workspaceId) {
    if (workspaceId === null || typeof workspaceId === 'undefined') {
      return [];
    }
    let q = `
      SELECT id, workspace_id, name, created, created_by, modified, modified_by, val
      FROM agent_networks
      WHERE workspace_id = $1
      `;
    const { rows } = await pg.query(q, [workspaceId]);
    if (rows.length === 0) {
      return [];
    }
    return rows.map(mapRow);
  }

  async function getAgentNetworkByName(workspaceId, name) {
    if (workspaceId === null || typeof workspaceId === 'undefined') {
      return [];
    }
    if (name === null || typeof name === 'undefined') {
      return [];
    }
    let q = `
      SELECT id, workspace_id, name, type, created, created_by, modified, modified_by, val
      FROM agent_networks
      WHERE workspace_id = $1
      AND name = $2
      `;
    const { rows } = await pg.query(q, [workspaceId, name]);
    if (rows.length === 0) {
      return null;
    }
    return mapRow(rows[0]);
  }

  async function getAgentNetwork(id) {
    if (id === null || typeof id === 'undefined') {
      return null;
    }
    let q = `
      SELECT id, workspace_id, name, created, created_by, modified, modified_by, val
      FROM agent_networks
      WHERE id = $1
      `;
    const { rows } = await pg.query(q, [id]);
    if (rows.length === 0) {
      return null;
    }
    return mapRow(rows[0]);
  }

  async function upsertAgentNetwork(agentNetwork, username, partial) {
    if (agentNetwork === null || typeof agentNetwork === 'undefined') {
      return null;
    }
    const omittedFields = ['id', 'workspaceId', 'name', 'created', 'createdBy', 'modified', 'modifiedBy'];
    const savedAgentNetwork = await getAgentNetwork(agentNetwork.id);
    if (savedAgentNetwork) {
      if (partial) {
        agentNetwork = { ...savedAgentNetwork, ...agentNetwork };
      }
      const val = omit(agentNetwork, omittedFields);
      const modified = new Date();
      const { rows } = await pg.query(`
        UPDATE agent_networks
        SET name = $1, val = $2, modified_by = $3, modified = $4
        WHERE id = $5
        RETURNING *
        `,
        [agentNetwork.name, val, username, modified, agentNetwork.id]
      );
      return mapRow(rows[0]);

    } else {
      const val = omit(agentNetwork, omittedFields);
      const created = new Date();
      const { rows } = await pg.query(`
        INSERT INTO agent_networks (workspace_id, name, val, created_by, created, modified_by, modified)
        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
        `,
        [agentNetwork.workspaceId, agentNetwork.name, val, username, created, username, created]
      );
      return mapRow(rows[0]);
    }
  }

  async function deleteAgentNetworks(ids) {
    if (ids === null || typeof ids === 'undefined') {
      return [];
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return [];
    }
    await pg.query(`
      DELETE FROM agent_networks WHERE id = ANY($1::INT[])
      `, [ids]);
    return ids;
  }

  return {
    getAgentNetworksCount,
    getAgentNetworks,
    getAgentNetworkByName,
    getAgentNetwork,
    upsertAgentNetwork,
    deleteAgentNetworks,
  };
}
