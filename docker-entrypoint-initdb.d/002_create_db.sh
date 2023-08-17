#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
	CREATE DATABASE promptstore;
	CREATE USER psadmin WITH encrypted password 'changeme';
	GRANT ALL PRIVILEGES ON DATABASE promptstore TO psadmin;
EOSQL