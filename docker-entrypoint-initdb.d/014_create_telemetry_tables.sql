-- Agentic-harness observability: canonical spans, telemetry API keys, budgets.
-- These init scripts only run on a fresh database volume. For an existing
-- deployment, apply this file manually (psql -f) once.

-- ---------------------------------------------------------------------------
-- Table: public."spans"
-- Flat, canonical span store. The trace tree is reconstructed on read from
-- parent_span_id; nothing is stored nested. Token/cost columns mirror the
-- RosettaStone usage vocabulary. Engine-agnostic: PostgresSpanStore reads/
-- writes this table today; a ClickHouseSpanStore can replace it later.
-- ---------------------------------------------------------------------------

DROP TABLE IF EXISTS public."spans";

DROP SEQUENCE IF EXISTS public."spans_id_seq";

CREATE SEQUENCE public."spans_id_seq" AS bigint;

CREATE TABLE public."spans"
(
    id bigint NOT NULL DEFAULT nextval('"spans_id_seq"'::regclass),
    trace_id character varying(32) NOT NULL,
    span_id character varying(16) NOT NULL,
    parent_span_id character varying(16),
    workspace_id integer NOT NULL,
    span_kind character varying(64) NOT NULL,
    name character varying(512),
    start_time TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP(6) WITH TIME ZONE,
    status character varying(16) NOT NULL DEFAULT 'unset',
    status_message text,
    provider character varying(128),
    request_model character varying(256),
    response_model character varying(256),
    prompt_tokens integer,
    completion_tokens integer,
    total_tokens integer,
    cached_tokens integer,
    reasoning_tokens integer,
    cost_input numeric(18,8),
    cost_output numeric(18,8),
    cost_total numeric(18,8),
    currency character varying(8) DEFAULT 'USD',
    attributes json,
    events json,
    links json,
    payload_ref character varying(512),
    session_id character varying(128),
    user_id character varying(255),
    sdk_version character varying(64),
    seq bigint,
    received_at TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT "spans_pkey" PRIMARY KEY (id),
    CONSTRAINT "spans_span_uniq" UNIQUE (trace_id, span_id)
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE public."spans" OWNER to psadmin;
ALTER SEQUENCE public."spans_id_seq" OWNER to psadmin;
ALTER SEQUENCE public."spans_id_seq" OWNED BY public."spans"."id";

-- Tree reads by trace, workspace-scoped analytics, and live replay by seq.
CREATE INDEX "spans_ws_trace_start_idx" ON public."spans" (workspace_id, trace_id, start_time);
CREATE INDEX "spans_ws_start_idx" ON public."spans" (workspace_id, start_time);
CREATE INDEX "spans_trace_seq_idx" ON public."spans" (trace_id, seq);
CREATE INDEX "spans_ws_kind_start_idx" ON public."spans" (workspace_id, span_kind, start_time);

-- ---------------------------------------------------------------------------
-- Table: public."span_payloads"
-- Full captured content (model input/output, tool IO) offloaded off the hot
-- `spans` row so it stays lean. Keyed by (workspace_id, trace_id, span_id).
-- Content is redacted client-side by the SDK before it ever arrives. The
-- PostgresPayloadStore reads/writes this today; a MinIO-backed store can slot
-- in later behind the same PayloadStore interface (span.payload_ref is the key).
-- ---------------------------------------------------------------------------

DROP TABLE IF EXISTS public."span_payloads";

CREATE TABLE public."span_payloads"
(
    workspace_id integer NOT NULL,
    trace_id character varying(32) NOT NULL,
    span_id character varying(16) NOT NULL,
    content json,
    created TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT "span_payloads_pkey" PRIMARY KEY (trace_id, span_id)
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE public."span_payloads" OWNER to psadmin;

CREATE INDEX "span_payloads_ws_trace_idx" ON public."span_payloads" (workspace_id, trace_id);

-- ---------------------------------------------------------------------------
-- Table: public."api_keys"
-- Hashed (sha256 hex), indexed, revocable keys. type='telemetry' keys are
-- write-only (scopes: ['telemetry:write']) so a key leaked in a client bundle
-- cannot read traces or invoke functions. Legacy per-workspace JSON apiKeys
-- continue to work via WorkspacesService for backward compatibility.
-- ---------------------------------------------------------------------------

DROP TABLE IF EXISTS public."api_keys";

DROP SEQUENCE IF EXISTS public."api_keys_id_seq";

CREATE SEQUENCE public."api_keys_id_seq" AS bigint;

CREATE TABLE public."api_keys"
(
    id bigint NOT NULL DEFAULT nextval('"api_keys_id_seq"'::regclass),
    hash character varying(64) NOT NULL,
    workspace_id integer NOT NULL,
    type character varying(32) NOT NULL DEFAULT 'full',
    scopes json,
    label character varying(255),
    username character varying(255),
    revoked boolean NOT NULL DEFAULT false,
    last_used_at TIMESTAMP(0) WITH TIME ZONE,
    created TIMESTAMP(0) NOT NULL DEFAULT NOW(),
    created_by character varying(255) COLLATE pg_catalog."default",
    CONSTRAINT "api_keys_pkey" PRIMARY KEY (id),
    CONSTRAINT "api_keys_hash_uniq" UNIQUE (hash)
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE public."api_keys" OWNER to psadmin;
ALTER SEQUENCE public."api_keys_id_seq" OWNER to psadmin;
ALTER SEQUENCE public."api_keys_id_seq" OWNED BY public."api_keys"."id";

-- ---------------------------------------------------------------------------
-- Table: public."budgets"  (used from Phase 4 onward)
-- Per-workspace spend limits evaluated against span cost rollups.
-- ---------------------------------------------------------------------------

DROP TABLE IF EXISTS public."budgets";

DROP SEQUENCE IF EXISTS public."budgets_id_seq";

CREATE SEQUENCE public."budgets_id_seq" AS bigint;

CREATE TABLE public."budgets"
(
    id bigint NOT NULL DEFAULT nextval('"budgets_id_seq"'::regclass),
    workspace_id integer NOT NULL,
    period character varying(16) NOT NULL DEFAULT 'month',
    limit_amount numeric(18,4) NOT NULL,
    currency character varying(8) DEFAULT 'USD',
    alert_thresholds json,
    scope json,
    created TIMESTAMP(0) NOT NULL DEFAULT NOW(),
    created_by character varying(255) COLLATE pg_catalog."default",
    modified TIMESTAMP(0) NOT NULL DEFAULT NOW(),
    modified_by character varying(255) COLLATE pg_catalog."default",
    CONSTRAINT "budgets_pkey" PRIMARY KEY (id)
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE public."budgets" OWNER to psadmin;
ALTER SEQUENCE public."budgets_id_seq" OWNER to psadmin;
ALTER SEQUENCE public."budgets_id_seq" OWNED BY public."budgets"."id";

CREATE INDEX "budgets_ws_idx" ON public."budgets" (workspace_id);
