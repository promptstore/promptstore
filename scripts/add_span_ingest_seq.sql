-- Server-assigned ingest cursor for spans.
--
-- `spans.seq` is the SDK's: it counts from `_seq_by_trace`, a dict held on the
-- telemetry client *instance*, so it is monotonic per emitting process rather
-- than per trace. A run served by two replicas -- or by one process either side
-- of a restart -- carries several counters that each begin again at zero, so
-- within a single trace `seq` repeats and goes backwards. Anything that treats
-- it as a cursor is therefore broken by a restart: live tailing filtered
-- `seq > lastSeq`, which silently skipped every span the new process wrote and
-- left the trace looking as though it had stopped growing.
--
-- `ingest_seq` is assigned here instead, from one sequence shared by every
-- writer, and re-assigned on each upsert so a span's end patch reaches a
-- tailing client the same way its start did. `seq` is kept as the emitter
-- reported it -- it still identifies the writer's own ordering, which is worth
-- having when a batch has to be reasoned about after the fact.
--
-- Apply by hand to an existing deployment:
--   psql "$PROMPTSTORE_DSN" -f scripts/add_span_ingest_seq.sql
-- A fresh volume gets the same statements from
-- docker-entrypoint-initdb.d/016_add_span_ingest_seq.sql.
--
-- Idempotent: safe to re-run.

CREATE SEQUENCE IF NOT EXISTS public."spans_ingest_seq" AS bigint;

ALTER TABLE public."spans" ADD COLUMN IF NOT EXISTS ingest_seq bigint;

-- Existing rows take their order from `id`, which came from a global sequence
-- of the same shape, so the backfill preserves the order they arrived in.
UPDATE public."spans" SET ingest_seq = id WHERE ingest_seq IS NULL;

-- Continue above everything already handed out, so a cursor a client is holding
-- can never be overtaken from below.
SELECT setval('public."spans_ingest_seq"',
              GREATEST((SELECT COALESCE(MAX(ingest_seq), 0) FROM public."spans"), 1));

ALTER TABLE public."spans" ALTER COLUMN ingest_seq SET DEFAULT nextval('public."spans_ingest_seq"');
ALTER TABLE public."spans" ALTER COLUMN ingest_seq SET NOT NULL;

-- Match the table's owner rather than naming one: this file is applied by hand
-- to deployments whose span table is not owned by the same role as the volume
-- the init scripts built. It has to precede OWNED BY, which refuses a sequence
-- and a table that belong to different roles.
DO $$
DECLARE owner_name text;
BEGIN
  SELECT tableowner INTO owner_name FROM pg_tables WHERE schemaname = 'public' AND tablename = 'spans';
  IF owner_name IS NOT NULL THEN
    EXECUTE format('ALTER SEQUENCE public.%I OWNER TO %I', 'spans_ingest_seq', owner_name);
  END IF;
END $$;

ALTER SEQUENCE public."spans_ingest_seq" OWNED BY public."spans"."ingest_seq";

-- The live-tail read: one trace, everything past a cursor, in cursor order.
CREATE INDEX IF NOT EXISTS "spans_trace_ingest_seq_idx" ON public."spans" (trace_id, ingest_seq);
