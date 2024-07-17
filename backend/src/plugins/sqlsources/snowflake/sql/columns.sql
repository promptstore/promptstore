SELECT table_schema,
       table_name,
       column_name
FROM `${dataset}`.information_schema.columns
WHERE LOWER(table_schema) NOT IN ('information_schema')
AND table_name = '${table_name}'