import crypto from 'crypto';

// Short-lived signed tokens that authorize an SSE live-stream connection.
// EventSource cannot send Authorization headers, so an authenticated endpoint
// mints one of these (scoped to a workspace, optionally a trace) and the client
// passes it as ?token=. The token only needs to survive the SSE handshake.
//
// The secret MUST be shared across replicas for tokens minted on one instance to
// verify on another. Set TELEMETRY_STREAM_SECRET in production.

const SECRET = process.env.TELEMETRY_STREAM_SECRET || 'promptstore-telemetry-stream-dev-secret';
const DEFAULT_TTL_MS = 60 * 1000;

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function sign(payloadB64) {
  return b64url(crypto.createHmac('sha256', SECRET).update(payloadB64).digest());
}

export function signStreamToken({ workspaceId, traceId = null, ttlMs = DEFAULT_TTL_MS }) {
  const payload = { ws: workspaceId, trace: traceId, exp: Date.now() + ttlMs };
  const payloadB64 = b64url(JSON.stringify(payload));
  return `${payloadB64}.${sign(payloadB64)}`;
}

// Returns the decoded payload { ws, trace, exp } if valid & unexpired, else null.
export function verifyStreamToken(token) {
  try {
    if (!token || typeof token !== 'string') return null;
    const [payloadB64, sig] = token.split('.');
    if (!payloadB64 || !sig) return null;
    const expected = sign(payloadB64);
    // constant-time compare
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(payloadB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch (err) {
    return null;
  }
}
