-- Agent harness sessions.
--
-- A session is an append-only tree of entries (after the pi harness session
-- format): every entry has a parent, and `leaf_id` is the current position.
-- Branching moves the leaf to an earlier entry so new entries fork from there.
-- The model context for a session is rebuilt by walking leaf -> root, honouring
-- compaction checkpoints (see backend/src/lib/harness/session.ts).
--
-- NOTE: docker-entrypoint-initdb.d only runs on a fresh Postgres volume. For an
-- existing deployment, run this file (scripts/create_harness_sessions.sql) by hand via psql.
--
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS public."harness_sessions"
(
    id character varying(64) NOT NULL,
    workspace_id integer NOT NULL,
    function_id character varying(64),
    leaf_id character varying(32),
    created_by character varying(255),
    created TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT "harness_sessions_pkey" PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS "harness_sessions_workspace_idx"
    ON public."harness_sessions" (workspace_id, updated DESC);

CREATE TABLE IF NOT EXISTS public."harness_session_entries"
(
    seq bigserial NOT NULL,
    id character varying(32) NOT NULL,
    session_id character varying(64) NOT NULL
        REFERENCES public."harness_sessions" (id) ON DELETE CASCADE,
    parent_id character varying(32),
    type character varying(32) NOT NULL,
    val jsonb NOT NULL,
    created TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT "harness_session_entries_pkey" PRIMARY KEY (session_id, id)
);

CREATE INDEX IF NOT EXISTS "harness_session_entries_session_seq_idx"
    ON public."harness_session_entries" (session_id, seq);
