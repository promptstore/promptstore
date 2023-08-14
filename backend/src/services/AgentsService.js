import omit from 'lodash.omit';

export function AgentsService({ pg, logger }) {

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
    const agents = rows.map((row) => ({
      ...row.val,
      id: row.id,
      name: row.name,
      workspaceId: row.workspace_id,
      created: row.created,
      createdBy: row.created_by,
      modified: row.modified,
      modifiedBy: row.modified_by,
    }));
    return agents;
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
    const row = rows[0];
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

  async function upsertAgent(agent, username) {
    if (agent === null || typeof agent === 'undefined') {
      return null;
    }
    const val = omit(agent, ['id', 'workspaceId', 'name', 'created', 'createdBy', 'modified', 'modifiedBy']);
    const savedAgent = await getAgent(agent.id);
    if (savedAgent) {
      await pg.query(`
        UPDATE agents
        SET name = $1, val = $2, modified_by = $3, modified = $4
        WHERE id = $5
        `,
        [agent.name, val, username, new Date(), agent.id]
      );
      return { ...savedAgent, ...agent };
    } else {
      const created = new Date();
      const { rows } = await pg.query(`
        INSERT INTO agents (workspace_id, name, val, created_by, created, modified_by, modified)
        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
        `,
        [agent.workspaceId, agent.name, val, username, created, username, created]
      );
      return { ...agent, id: rows[0].id };
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
    getAgents,
    getAgent,
    upsertAgent,
    deleteAgents,
  };
}
