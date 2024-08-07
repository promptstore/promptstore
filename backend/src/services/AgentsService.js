import omit from 'lodash.omit';

export function AgentsService({ pg, logger }) {

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

  async function getAgentsCount(workspaceId) {
    if (workspaceId === null || typeof workspaceId === 'undefined') {
      return -1;
    }
    let q = `
      SELECT COUNT(id) AS k
      FROM agents
      WHERE workspace_id = $1 OR workspace_id = 1
      OR (val->>'isPublic')::boolean = true
      `;
    const { rows } = await pg.query(q, [workspaceId]);
    if (rows.length === 0) {
      return 0;
    }
    return rows[0].k;
  }

  async function getAgents(workspaceId) {
    if (workspaceId === null || typeof workspaceId === 'undefined') {
      return [];
    }
    let q = `
      SELECT id, workspace_id, name, created, created_by, modified, modified_by, val
      FROM agents
      WHERE workspace_id = $1
      `;
    const { rows } = await pg.query(q, [workspaceId]);
    if (rows.length === 0) {
      return [];
    }
    return rows.map(mapRow);
  }

  async function getAgent(id) {
    if (id === null || typeof id === 'undefined') {
      return null;
    }
    let q = `
      SELECT id, workspace_id, name, created, created_by, modified, modified_by, val
      FROM agents
      WHERE id = $1
      `;
    const { rows } = await pg.query(q, [id]);
    if (rows.length === 0) {
      return null;
    }
    return mapRow(rows[0]);
  }

  async function upsertAgent(agent, username, partial) {
    if (agent === null || typeof agent === 'undefined') {
      return null;
    }
    const omittedFields = ['id', 'workspaceId', 'name', 'created', 'createdBy', 'modified', 'modifiedBy'];
    const savedAgent = await getAgent(agent.id);
    if (savedAgent) {
      if (partial) {
        agent = { ...savedAgent, ...agent, metricStoreSourceId: null };
      }
      const val = omit(agent, omittedFields);
      const modified = new Date();
      const { rows } = await pg.query(`
        UPDATE agents
        SET name = $1, val = $2, modified_by = $3, modified = $4
        WHERE id = $5
        RETURNING *
        `,
        [agent.name, val, username, modified, agent.id]
      );
      return mapRow(rows[0]);

    } else {
      const val = omit(agent, omittedFields);
      const created = new Date();
      const { rows } = await pg.query(`
        INSERT INTO agents (workspace_id, name, val, created_by, created, modified_by, modified)
        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
        `,
        [agent.workspaceId, agent.name, val, username, created, username, created]
      );
      return mapRow(rows[0]);
    }
  }

  async function deleteAgents(ids) {
    if (ids === null || typeof ids === 'undefined') {
      return [];
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return [];
    }
    await pg.query(`
      DELETE FROM agents WHERE id = ANY($1::INT[])
      `, [ids]);
    return ids;
  }

  return {
    getAgentsCount,
    getAgents,
    getAgent,
    upsertAgent,
    deleteAgents,
  };
}
