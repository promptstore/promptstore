SELECT table_schema,
       table_name,
       column_name
FROM v_catalog.columns
WHERE LOWER(table_schema) NOT IN ('v_catalog', 'v_monitor', 'v_internal')
AND table_name = '${table_name}'