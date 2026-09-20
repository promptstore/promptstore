-- Backfill the default role onto users that have none.
--
-- Run this by hand against an existing database:
--   psql "$DATABASE_URL" -f scripts/backfill_user_roles.sql
-- The copy in docker-entrypoint-initdb.d/015_backfill_user_roles.sql covers
-- fresh installs only, since Postgres skips that directory once PGDATA is
-- initialised.
--
-- The backend already substitutes DEFAULT_ROLE at request time for a user
-- holding no recognised role (see effectiveRoles in backend/src/config/roles.js),
-- so this is a cosmetic cleanup: it makes the admin Users list and the
-- frontend menu filter show what is actually being enforced.
--
-- Idempotent: only touches rows with a missing, non-array or empty roles value.
-- `val` is a `json` column, not `jsonb`, so it is cast before the jsonb_* calls.

UPDATE users
SET val = jsonb_set(val::jsonb, '{roles}', '["promptengineer"]'::jsonb)
WHERE val::jsonb->'roles' IS NULL
   OR jsonb_typeof(val::jsonb->'roles') <> 'array'
   OR jsonb_array_length(val::jsonb->'roles') = 0;
