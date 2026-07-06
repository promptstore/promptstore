import redis from 'redis';

// Redis pub/sub fan-out for live telemetry. Owns two DEDICATED redis v4 clients
// (a publisher and a subscriber) — deliberately not the shared legacyMode `rc`
// used for the session store — so we use the clean promise API and keep pub/sub
// off the session connection (a subscriber connection can't issue other commands).
//
// Fail-safe: if Redis is unavailable, connects fail quietly and publish/subscribe
// become no-ops. Ingestion still returns 202 and persists; the live path simply
// degrades to the client's polling fallback. The bus never throws into ingest.

export const traceChannel = (traceId) => `ps:telemetry:trace:${traceId}`;
export const workspaceChannel = (workspaceId) => `ps:telemetry:ws:${workspaceId}`;

export function TelemetryLiveBus({ logger }) {

  const url = `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}`;
  const password = process.env.REDIS_PASSWORD;

  let ready = false;
  let publisher = null;
  let subscriber = null;

  // channel -> Set<handler(messageString)>
  const handlers = new Map();

  (async () => {
    try {
      publisher = redis.createClient({ url, password });
      subscriber = redis.createClient({ url, password });
      publisher.on('error', (err) => logger.warn('TelemetryLiveBus publisher error:', err.message));
      subscriber.on('error', (err) => logger.warn('TelemetryLiveBus subscriber error:', err.message));
      await publisher.connect();
      await subscriber.connect();
      ready = true;
      logger.info('TelemetryLiveBus connected');
    } catch (err) {
      logger.warn('TelemetryLiveBus disabled (Redis unavailable):', err.message);
      ready = false;
    }
  })();

  // Called by TelemetryIngestService for each ingested span (its livePublisher
  // hook). Fire-and-forget; must not throw or block the ingest loop.
  function publish(span) {
    if (!ready || !publisher) return;
    try {
      const payload = JSON.stringify(span);
      publisher.publish(traceChannel(span.trace_id), payload).catch(() => { });
      // compact run-touch for the workspace list feed
      const touch = JSON.stringify({
        type: 'run.touch',
        trace_id: span.trace_id,
        workspace_id: span.workspace_id,
        running: !span.end_time,
        seq: span.seq,
        ts: span.end_time || span.start_time,
      });
      publisher.publish(workspaceChannel(span.workspace_id), touch).catch(() => { });
    } catch (err) {
      // never surface to caller
    }
  }

  // Subscribe a handler to a channel. Returns an unsubscribe function.
  async function subscribe(channel, handler) {
    if (!ready || !subscriber) {
      return () => { };
    }
    let set = handlers.get(channel);
    if (!set) {
      set = new Set();
      handlers.set(channel, set);
      try {
        await subscriber.subscribe(channel, (message) => {
          const hs = handlers.get(channel);
          if (!hs) return;
          for (const h of hs) {
            try { h(message); } catch (e) { /* one bad consumer must not affect others */ }
          }
        });
      } catch (err) {
        logger.warn('TelemetryLiveBus subscribe failed:', err.message);
        handlers.delete(channel);
        return () => { };
      }
    }
    set.add(handler);
    return async () => {
      const hs = handlers.get(channel);
      if (!hs) return;
      hs.delete(handler);
      if (hs.size === 0) {
        handlers.delete(channel);
        try { await subscriber.unsubscribe(channel); } catch (e) { /* ignore */ }
      }
    };
  }

  function isReady() {
    return ready;
  }

  return { publish, subscribe, isReady, traceChannel, workspaceChannel };
}
