SELECT table_schema,
       table_name,
       column_name
FROM information_schema.columns
WHERE LOWER(table_schema) NOT IN ('information_schema', 'pg_catalog', 'pg_toast', 'pg_internal', 'catalog_history')
AND table_name = '${table_name}'