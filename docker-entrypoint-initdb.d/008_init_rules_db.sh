#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE rules_db;
    CREATE USER rules_user WITH encrypted password 'changeme';
    GRANT all privileges ON database rules_db to rules_user;
EOSQL