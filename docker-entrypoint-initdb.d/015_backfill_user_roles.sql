-- Backfill the default role onto users that have none.
--
-- NOTE: docker-entrypoint-initdb.d only runs on a fresh Postgres volume, so
-- this does nothing for an existing deployment. For those, run the identical
-- statement in scripts/backfill_user_roles.sql by hand via psql.
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
