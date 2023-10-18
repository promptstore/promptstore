import omit from 'lodash.omit';

export function ChatSessionsService({ pg, logger }) {

  function mapRow(row) {
    return {
      ...row.val,
      id: row.id,
      name: row.name,
      type: row.type,
      workspaceId: row.workspace_id,
      created: row.created,
      createdBy: row.created_by,
      modified: row.modified,
      modifiedBy: row.modified_by,
    };
  }

  async function getChatSessions(workspaceId, type, username) {
    let q = `
      SELECT id, workspace_id, name, type, created, created_by, modified, modified_by, val
      FROM chat_sessions
      WHERE workspace_id = $1 AND type = $2 AND created_by = $3
      `;
    const { rows } = await pg.query(q, [workspaceId, type, username]);
    if (rows.length === 0) {
      return [];
    }
    return rows.map(mapRow);
  }

  async function getChatSession(id) {
    if (id === null || typeof id === 'undefined') {
      return null;
    }
    let q = `
      SELECT id, workspace_id, name, type, created, created_by, modified, modified_by, val
      FROM chat_sessions
      WHERE id = $1
      `;
    const { rows } = await pg.query(q, [id]);
    if (rows.length === 0) {
      return null;
    }
    return mapRow(rows[0]);
  }

  async function getChatSessionByName(name, username) {
    if (name === null || typeof name === 'undefined') {
      return null;
    }
    let q = `
      SELECT id, workspace_id, name, type, created, created_by, modified, modified_by, val
      FROM chat_sessions
      WHERE name = $1 AND created_by = $2
      `;
    const { rows } = await pg.query(q, [name, username]);
    if (rows.length === 0) {
      return null;
    }
    return mapRow(rows[0]);
  }

  async function upsertChatSession(session, username) {
    if (session === null || typeof session === 'undefined') {
      return null;
    }
    const val = omit(session, ['id', 'workspaceId', 'name', 'type', 'created', 'createdBy', 'modified', 'modifiedBy']);
    const savedChatSession = await getChatSession(session.id);
    if (savedChatSession) {
      const modified = new Date();
      const { rows } = await pg.query(`
        UPDATE chat_sessions
        SET name = $1, val = $2, modified_by = $3, modified = $4
        WHERE id = $5
        RETURNING *
        `,
        [session.name, val, username, modified, session.id]
      );
      return mapRow(rows[0]);
    } else {
      const created = new Date();
      const { rows } = await pg.query(`
        INSERT INTO chat_sessions (workspace_id, name, type, val, created_by, created, modified_by, modified)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id
        `,
        [session.workspaceId, session.name, session.type, val, username, created, username, created]
      );
      return { ...session, id: rows[0].id };
    }
  }

  async function deleteChatSessions(ids) {
    if (ids === null || typeof ids === 'undefined') {
      return [];
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return [];
    }
    await pg.query(`
      DELETE FROM chat_sessions WHERE id = ANY($1::INT[])
      `, [ids]);
    return ids;
  }

  return {
    getChatSessions,
    getChatSession,
    getChatSessionByName,
    upsertChatSession,
    deleteChatSessions,
  };
}
