SELECT table_schema,
       table_name,
       column_name
FROM information_schema.columns
WHERE LOWER(table_schema) NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
AND table_name = '${table_name}'