import crypto from 'crypto';

// Manages hashed, revocable API keys stored in the `api_keys` table.
// The raw key is returned exactly once (at creation); only its sha256 hash is
// persisted, so a leaked database never yields usable keys. type='telemetry'
// keys are write-only (scopes: ['telemetry:write']).

const TELEMETRY_KEY_PREFIX = 'pst_';

export function ApiKeysService({ pg, logger }) {

  function hashKey(rawKey) {
    return crypto.createHash('sha256').update(rawKey, 'utf8').digest('hex');
  }

  function generateRawKey(prefix = TELEMETRY_KEY_PREFIX) {
    return prefix + crypto.randomBytes(32).toString('hex');
  }

  function mapRow(row) {
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      type: row.type,
      scopes: row.scopes || [],
      label: row.label,
      username: row.username,
      revoked: row.revoked,
      lastUsedAt: row.last_used_at,
      created: row.created,
      createdBy: row.created_by,
    };
  }

  // Look up a live (non-revoked) key by its raw value. Returns the mapped
  // record or null. Best-effort updates last_used_at.
  async function getByRawKey(rawKey) {
    if (!rawKey || rawKey === 'undefined') {
      return null;
    }
    const hash = hashKey(rawKey);
    const { rows } = await pg.query(`
      SELECT id, hash, workspace_id, type, scopes, label, username, revoked, last_used_at, created, created_by
      FROM api_keys
      WHERE hash = $1 AND revoked = false
      `, [hash]);
    if (rows.length === 0) {
      return null;
    }
    // fire-and-forget usage stamp; never block auth on it
    pg.query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [rows[0].id])
      .catch(err => logger.error('Failed to stamp api_key last_used_at:', err.message));
    return mapRow(rows[0]);
  }

  // Create a key. Returns { key: <raw>, record }. The raw key is not recoverable later.
  async function createKey({ workspaceId, type = 'telemetry', scopes, label, username, createdBy }) {
    const rawKey = generateRawKey();
    const hash = hashKey(rawKey);
    const effectiveScopes = scopes || (type === 'telemetry' ? ['telemetry:write'] : ['*']);
    const { rows } = await pg.query(`
      INSERT INTO api_keys (hash, workspace_id, type, scopes, label, username, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, hash, workspace_id, type, scopes, label, username, revoked, last_used_at, created, created_by
      `, [hash, workspaceId, type, JSON.stringify(effectiveScopes), label, username, createdBy]);
    return { key: rawKey, record: mapRow(rows[0]) };
  }

  async function listKeys(workspaceId) {
    const { rows } = await pg.query(`
      SELECT id, hash, workspace_id, type, scopes, label, username, revoked, last_used_at, created, created_by
      FROM api_keys
      WHERE workspace_id = $1
      ORDER BY created DESC
      `, [workspaceId]);
    return rows.map(mapRow);
  }

  async function revokeKey(id) {
    await pg.query('UPDATE api_keys SET revoked = true WHERE id = $1', [id]);
    return id;
  }

  return {
    hashKey,
    getByRawKey,
    createKey,
    listKeys,
    revokeKey,
  };
}
