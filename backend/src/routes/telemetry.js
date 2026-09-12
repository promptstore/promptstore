// Agentic-harness telemetry: span ingestion (SDK), trace reads (UI), and
// telemetry API-key management.
//
// Ingestion (POST /v1/telemetry/spans) is designed to be fail-safe and
// multi-replica safe: it binds the workspace from the API key (ignoring any
// body-supplied workspaceId), holds no correlation state, and returns 202
// immediately. Read endpoints live under the workspace-scoped /api namespace so
// write-only telemetry keys (restricted to /v1/telemetry by auth) cannot read.

import { signStreamToken, verifyStreamToken } from '../services/telemetryStreamToken';
import { traceChannel, workspaceChannel } from '../services/TelemetryLiveBus';

export default ({ app, auth, logger, services }) => {

  const { telemetryIngestService, spanReadService, spanStore, apiKeysService, telemetryLiveBus, payloadStore } = services;

  // ~1MB per-connection buffer cap; a slow SSE client drops intermediate spans
  // rather than back-pressuring the event loop. Dropped spans are recovered on
  // reconnect via Last-Event-ID replay.
  const SSE_WRITABLE_CAP = 1 << 20;

  function sseHeaders(res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',   // disable nginx proxy buffering
    });
    if (res.flushHeaders) res.flushHeaders();
  }

  function hasWriteScope(req) {
    // JWT / full-key users have no apiKeyScopes and are allowed; scoped keys
    // must carry telemetry:write (or wildcard).
    if (!req.apiKeyScopes) return true;
    return req.apiKeyScopes.includes('*') || req.apiKeyScopes.includes('telemetry:write');
  }

  // ---- Ingestion (native SDK) -------------------------------------------------
  app.post('/v1/telemetry/spans', auth, async (req, res) => {
    if (!hasWriteScope(req)) {
      return res.status(403).json('Forbidden: telemetry:write scope required');
    }
    // Workspace is authoritative from the API key; fall back to body only for
    // JWT/internal callers that have no key-bound workspace.
    const workspaceId = req.apiKeyWorkspaceId != null
      ? req.apiKeyWorkspaceId
      : (req.body?.workspaceId != null ? +req.body.workspaceId : null);
    if (workspaceId == null) {
      return res.status(400).json('workspaceId could not be determined');
    }
    const spans = req.body?.spans || [];
    // Respond 202 first; ingestion continues in the background so the client is
    // never blocked on our storage.
    res.status(202).json({ received: Array.isArray(spans) ? spans.length : 0 });
    try {
      const result = await telemetryIngestService.ingest(spans, {
        workspaceId,
        username: req.user?.username,
      });
      if (result.dropped) {
        logger.warn(`telemetry ingest ws=${workspaceId}: accepted=${result.accepted} dropped=${result.dropped}`);
      }
    } catch (err) {
      logger.error('telemetry ingest failed:', err.message);
    }
  });

  // ---- Trace reads (UI) -------------------------------------------------------
  app.get('/api/workspaces/:workspaceId/harness-traces', auth, async (req, res) => {
    const workspaceId = +req.params.workspaceId;
    const { limit, start, name, from, to, status, session } = req.query;
    const result = await spanStore.listTraces(workspaceId, {
      limit: limit ? +limit : 50,
      offset: start ? +start : 0,
      name,
      from,
      to,
      status,
      sessionId: session,
    });
    res.json({ count: result.count, data: result.data });
  });

  app.get('/api/workspaces/:workspaceId/harness-traces/:traceId', auth, async (req, res) => {
    const workspaceId = +req.params.workspaceId;
    const { traceId } = req.params;
    const sinceSeq = req.query.since != null ? +req.query.since : undefined;
    const trace = await spanReadService.getTrace(workspaceId, traceId, { sinceSeq });
    res.json(trace);
  });

  // Captured content (model/tool input & output) for one span, lazily fetched by
  // the content panel. Workspace-scoped; served only over the /api surface, so
  // write-only telemetry keys (restricted to /v1/telemetry) can never read it.
  app.get('/api/workspaces/:workspaceId/harness-traces/:traceId/spans/:spanId/payload', auth, async (req, res) => {
    if (!payloadStore) return res.status(404).json(null);
    const workspaceId = +req.params.workspaceId;
    const { traceId, spanId } = req.params;
    const content = await payloadStore.get(workspaceId, traceId, spanId);
    if (content == null) return res.status(404).json(null);
    res.json({ content });
  });

  // Bulk-delete traces. Body: { traceIds: string[] }. Workspace-scoped in the
  // store so a caller can only delete its own workspace's traces.
  app.post('/api/workspaces/:workspaceId/harness-traces/delete', auth, async (req, res) => {
    const workspaceId = +req.params.workspaceId;
    const traceIds = Array.isArray(req.body?.traceIds) ? req.body.traceIds.filter(Boolean) : [];
    if (traceIds.length === 0) {
      return res.status(400).json('traceIds must be a non-empty array');
    }
    const result = await spanStore.deleteTraces(workspaceId, traceIds);
    logger.info(`telemetry delete ws=${workspaceId}: traces=${result.traces} spans=${result.spans}`);
    res.json(result);
  });

  // ---- Telemetry key management (JWT / full-key auth) -------------------------
  app.post('/api/workspaces/:workspaceId/telemetry-keys', auth, async (req, res) => {
    const workspaceId = +req.params.workspaceId;
    const { label, type } = req.body || {};
    const { key, record } = await apiKeysService.createKey({
      workspaceId,
      type: type || 'telemetry',
      label,
      username: req.user?.username,
      createdBy: req.user?.username,
    });
    // The raw key is returned exactly once.
    res.json({ key, record });
  });

  app.get('/api/workspaces/:workspaceId/telemetry-keys', auth, async (req, res) => {
    const workspaceId = +req.params.workspaceId;
    const keys = await apiKeysService.listKeys(workspaceId);
    res.json(keys);
  });

  app.delete('/api/telemetry-keys/:id', auth, async (req, res) => {
    const id = +req.params.id;
    await apiKeysService.revokeKey(id);
    res.json(id);
  });

  // ---- Live streaming (SSE) ---------------------------------------------------
  // Stream tokens are minted by authenticated endpoints and passed as ?token=,
  // because EventSource cannot set an Authorization header.

  app.post('/api/workspaces/:workspaceId/harness-traces/:traceId/stream-token', auth, (req, res) => {
    const workspaceId = +req.params.workspaceId;
    const { traceId } = req.params;
    const token = signStreamToken({ workspaceId, traceId });
    res.json({ token });
  });

  app.post('/api/workspaces/:workspaceId/harness-stream-token', auth, (req, res) => {
    const workspaceId = +req.params.workspaceId;
    const token = signStreamToken({ workspaceId });
    res.json({ token });
  });

  // Per-trace live tail. No `auth` middleware — the stream token is the gate.
  app.get('/v1/telemetry/traces/:traceId/stream', async (req, res) => {
    const { traceId } = req.params;
    const claims = verifyStreamToken(req.query.token);
    if (!claims || String(claims.trace) !== String(traceId)) {
      return res.status(401).end();
    }
    const workspaceId = +claims.ws;
    sseHeaders(res);

    const writtenSeqs = new Set();
    const writeSpan = (span) => {
      if (res.writableLength > SSE_WRITABLE_CAP) return;   // slow client — drop, recover on reconnect
      if (span.seq != null) {
        if (writtenSeqs.has(span.seq)) return;             // dedupe replay vs live overlap
        writtenSeqs.add(span.seq);
      }
      res.write(`id: ${span.seq != null ? span.seq : ''}\ndata: ${JSON.stringify(span)}\n\n`);
    };

    // Subscribe first and buffer, so nothing published during replay is lost.
    let replaying = true;
    const buffer = [];
    const onMessage = (message) => {
      try {
        const span = JSON.parse(message);
        if (replaying) { buffer.push(span); return; }
        writeSpan(span);
      } catch (e) { /* ignore malformed */ }
    };
    let unsubscribe = () => { };
    try {
      unsubscribe = await telemetryLiveBus.subscribe(traceChannel(traceId), onMessage);
    } catch (e) {
      logger.warn('trace stream subscribe failed:', e.message);
    }

    // Replay: Last-Event-ID (native reconnect) or ?since= backfills missed spans.
    const lastEventId = req.headers['last-event-id'] != null ? req.headers['last-event-id'] : req.query.since;
    const sinceSeq = lastEventId != null && lastEventId !== '' ? +lastEventId : undefined;
    try {
      const { spans } = await spanReadService.getTrace(workspaceId, traceId, sinceSeq != null ? { sinceSeq } : {});
      for (const s of spans) writeSpan(s);
    } catch (e) {
      logger.warn('trace stream replay failed:', e.message);
    }
    replaying = false;
    for (const s of buffer) writeSpan(s);
    buffer.length = 0;

    const heartbeat = setInterval(() => { try { res.write(': ping\n\n'); } catch (e) { /* closed */ } }, 15000);
    req.on('close', () => {
      clearInterval(heartbeat);
      Promise.resolve(unsubscribe()).catch(() => { });
    });
  });

  // Workspace-wide feed of run-touch events (new/updated runs). No replay.
  app.get('/v1/telemetry/workspaces/:workspaceId/stream', async (req, res) => {
    const workspaceId = +req.params.workspaceId;
    const claims = verifyStreamToken(req.query.token);
    if (!claims || +claims.ws !== workspaceId) {
      return res.status(401).end();
    }
    sseHeaders(res);
    const onMessage = (message) => {
      try {
        if (res.writableLength > SSE_WRITABLE_CAP) return;
        res.write(`data: ${message}\n\n`);
      } catch (e) { /* closed */ }
    };
    let unsubscribe = () => { };
    try {
      unsubscribe = await telemetryLiveBus.subscribe(workspaceChannel(workspaceId), onMessage);
    } catch (e) {
      logger.warn('workspace stream subscribe failed:', e.message);
    }
    const heartbeat = setInterval(() => { try { res.write(': ping\n\n'); } catch (e) { /* closed */ } }, 15000);
    req.on('close', () => {
      clearInterval(heartbeat);
      Promise.resolve(unsubscribe()).catch(() => { });
    });
  });

};
