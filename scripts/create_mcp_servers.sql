-- MCP servers: remote (or, when enabled, local stdio) Model Context Protocol
-- servers whose tools an agent harness can call. Connection settings live in
-- `val` (transport, url, headers, command, args, env, timeoutMs, enabled).
-- Header and env values may reference workspace secrets as {SECRET_NAME}.
--
-- NOTE: docker-entrypoint-initdb.d only runs on a fresh Postgres volume. For an
-- existing deployment, run this file (scripts/create_mcp_servers.sql) by hand via psql.
--
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS public."mcp_servers"
(
    id serial NOT NULL,
    workspace_id integer NOT NULL,
    name character varying(255) NOT NULL,
    created TIMESTAMP(0) NOT NULL DEFAULT NOW(),
    created_by character varying(255),
    modified TIMESTAMP(0) NOT NULL DEFAULT NOW(),
    modified_by character varying(255),
    val jsonb NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT "mcp_servers_pkey" PRIMARY KEY (id),
    CONSTRAINT "mcp_servers_workspace_name_key" UNIQUE (workspace_id, name)
);
