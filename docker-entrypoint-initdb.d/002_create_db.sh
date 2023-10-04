#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
	CREATE DATABASE promptstore;
	CREATE USER psadmin WITH encrypted password 'changeme';
	GRANT ALL PRIVILEGES ON DATABASE promptstore TO psadmin;
EOSQL

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
	CREATE DATABASE eparse;
	CREATE USER epadmin WITH encrypted password 'changeme';
	GRANT ALL PRIVILEGES ON DATABASE eparse TO epadmin;
EOSQL

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
	CREATE DATABASE offline_store;
	CREATE USER storeadmin WITH encrypted password 'changeme';
	GRANT ALL PRIVILEGES ON DATABASE offline_store TO storeadmin;
EOSQL