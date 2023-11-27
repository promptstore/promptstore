SELECT table_catalog, table_schema, table_name, column_name, data_type, is_nullable
FROM `${dataset}`.INFORMATION_SCHEMA.COLUMNS
WHERE table_name = '${table_name}'