import { newEntryId } from '../../lib/harness';
import type { NewSessionEntry, SessionEntry, SessionStore } from '../../lib/harness';

export interface SessionInfo {
  id: string;
  workspaceId: number;
  functionId?: string;
  leafId: string | null;
  createdBy?: string;
  created: string;
  updated: string;
}

/**
 * Postgres-backed harness session tree (tables in
 * docker-entrypoint-initdb.d/017_create_harness_sessions.sql).
 */
export function PostgresSessionStore({ pg, logger }: { pg: any; logger: any }) {

  async function getSession(sessionId: string): Promise<SessionInfo | null> {
    const { rows } = await pg.query(
      `SELECT id, workspace_id, function_id, leaf_id, created_by, created, updated
         FROM harness_sessions WHERE id = $1`,
      [sessionId]
    );
    if (!rows.length) return null;
    const r = rows[0];
    return {
      id: r.id,
      workspaceId: r.workspace_id,
      functionId: r.function_id,
      leafId: r.leaf_id,
      createdBy: r.created_by,
      created: r.created,
      updated: r.updated,
    };
  }

  /** Create the session if missing. Returns false if it belongs to another workspace. */
  async function ensureSession(sessionId: string, { workspaceId, functionId, username }: { workspaceId: number; functionId?: string; username?: string }) {
    await pg.query(
      `INSERT INTO harness_sessions (id, workspace_id, function_id, created_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING`,
      [sessionId, workspaceId, functionId || null, username || null]
    );
    const session = await getSession(sessionId);
    return session?.workspaceId === workspaceId;
  }

  async function getLeafId(sessionId: string) {
    const session = await getSession(sessionId);
    return session?.leafId ?? null;
  }

  async function append(sessionId: string, entry: NewSessionEntry): Promise<SessionEntry> {
    const client = await pg.connect();
    try {
      await client.query('BEGIN');
      // lock the session row so concurrent appends chain correctly
      const { rows } = await client.query(
        'SELECT leaf_id FROM harness_sessions WHERE id = $1 FOR UPDATE',
        [sessionId]
      );
      if (!rows.length) {
        throw new Error(`Session not found: ${sessionId}`);
      }
      const { type, ...data } = entry as any;
      const full = {
        ...entry,
        id: newEntryId(),
        parentId: rows[0].leaf_id,
        timestamp: new Date().toISOString(),
      } as SessionEntry;
      await client.query(
        `INSERT INTO harness_session_entries (id, session_id, parent_id, type, val)
         VALUES ($1, $2, $3, $4, $5)`,
        [full.id, sessionId, full.parentId, type, data]
      );
      await client.query(
        'UPDATE harness_sessions SET leaf_id = $2, updated = NOW() WHERE id = $1',
        [sessionId, full.id]
      );
      await client.query('COMMIT');
      return full;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => { });
      logger.error('PostgresSessionStore.append failed:', err.message);
      throw err;
    } finally {
      client.release();
    }
  }

  async function getEntries(sessionId: string): Promise<SessionEntry[]> {
    const { rows } = await pg.query(
      `SELECT id, parent_id, type, val, created
         FROM harness_session_entries WHERE session_id = $1 ORDER BY seq`,
      [sessionId]
    );
    return rows.map((r: any) => ({
      ...r.val,
      type: r.type,
      id: r.id,
      parentId: r.parent_id,
      timestamp: new Date(r.created).toISOString(),
    }));
  }

  async function branch(sessionId: string, entryId: string | null) {
    if (entryId) {
      const { rowCount } = await pg.query(
        'SELECT 1 FROM harness_session_entries WHERE session_id = $1 AND id = $2',
        [sessionId, entryId]
      );
      if (!rowCount) throw new Error(`Unknown entry ${entryId}`);
    }
    await pg.query(
      'UPDATE harness_sessions SET leaf_id = $2, updated = NOW() WHERE id = $1',
      [sessionId, entryId]
    );
  }

  const store: SessionStore & {
    getSession: typeof getSession;
    ensureSession: typeof ensureSession;
  } = {
    getLeafId,
    append,
    getEntries,
    branch,
    getSession,
    ensureSession,
  };
  return store;
}

export type PostgresSessionStoreService = ReturnType<typeof PostgresSessionStore>;
