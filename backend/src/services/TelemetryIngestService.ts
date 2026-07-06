import { Span, SpanKind } from '../core/telemetry/canonical';
import { SpanStore } from './spanstore/SpanStore';
import { PayloadStore } from './spanstore/PayloadStore';

// Accepts batches of canonical spans, enriches them (workspace binding + cost),
// and persists them via the SpanStore. Spans are self-describing (trace_id /
// parent_span_id), so ingestion holds NO correlation state — any replica can
// accept any span in any order. Returns immediately; callers respond 202.

const MAX_SPANS_PER_BATCH = 512;

export function TelemetryIngestService({ logger, spanStore, pricingService, livePublisher, payloadStore }: {
  logger: any;
  spanStore: SpanStore;
  pricingService?: any;
  livePublisher?: any;    // optional: Phase 2 Redis pub/sub fan-out
  payloadStore?: PayloadStore;   // optional: offload captured content off the span row
}) {

  function isValid(span: any): boolean {
    return span && typeof span.trace_id === 'string' && typeof span.span_id === 'string'
      && typeof span.span_kind === 'string' && typeof span.start_time === 'string';
  }

  // Ingest a batch. workspaceId is authoritative (bound from the API key);
  // any workspace_id on the incoming spans is overwritten.
  async function ingest(spans: Span[], { workspaceId, username }: { workspaceId: number; username?: string }): Promise<{ accepted: number; dropped: number }> {
    if (!Array.isArray(spans)) {
      return { accepted: 0, dropped: 0 };
    }
    let dropped = 0;
    const batch = spans.slice(0, MAX_SPANS_PER_BATCH);
    if (spans.length > MAX_SPANS_PER_BATCH) {
      dropped += spans.length - MAX_SPANS_PER_BATCH;
      logger.warn(`TelemetryIngest: batch of ${spans.length} exceeds ${MAX_SPANS_PER_BATCH}; dropped ${dropped} spans`);
    }

    const valid: Span[] = [];
    for (const raw of batch) {
      if (!isValid(raw)) { dropped++; continue; }
      raw.workspace_id = workspaceId;
      if (!raw.user_id && username) raw.user_id = username;
      valid.push(raw);
    }

    // Offload captured content (SDK sends it on the span as `content`) to the
    // payload store so it never lands on the hot spans row; keep only a
    // payload_ref. Best-effort — a payload failure must not lose the span.
    if (payloadStore) {
      await Promise.all(valid.map(async (span: any) => {
        if (span.content == null) return;
        try {
          span.payload_ref = await payloadStore.put(workspaceId, span.trace_id, span.span_id, span.content);
        } catch (err: any) {
          logger.error('TelemetryIngest: payload offload failed:', err.message);
        } finally {
          delete span.content;   // never persist content on the span row
        }
      }));
    } else {
      for (const span of valid as any[]) delete span.content;
    }

    // Compute cost for model.call spans that carry usage but no cost.
    if (pricingService) {
      await Promise.all(valid.map(async (span) => {
        if (span.span_kind === SpanKind.ModelCall && span.usage && span.cost_total == null) {
          try {
            const cost = await pricingService.computeCost({
              model: span.response_model || span.request_model,
              usage: span.usage,
              workspaceId,
            });
            if (cost) {
              span.cost_input = cost.cost_input;
              span.cost_output = cost.cost_output;
              span.cost_total = cost.cost_total;
              span.currency = cost.currency;
            }
          } catch (err: any) {
            logger.error('TelemetryIngest: cost computation failed:', err.message);
          }
        }
      }));
    }

    try {
      await spanStore.writeSpans(valid);
    } catch (err: any) {
      // Never surface storage failures to the client beyond a dropped count;
      // the SDK is the primary backpressure absorber.
      logger.error('TelemetryIngest: writeSpans failed:', err.message);
      return { accepted: 0, dropped: dropped + valid.length };
    }

    // Best-effort live fan-out (Phase 2). Must never affect the durable path.
    if (livePublisher) {
      for (const span of valid) {
        try { livePublisher.publish(span); } catch (e) { /* ignore */ }
      }
    }

    return { accepted: valid.length, dropped };
  }

  return { ingest };
}
