SELECT
  columns.column_name AS name,
  columns.data_type AS type,
  columns.udt_name::regtype AS udt,
  columns.column_default AS default,
  columns.is_nullable::boolean AS nullable,
  columns.character_maximum_length AS length,
  attributes.attndims AS dimensions,
  indexes.indisprimary AS isPrimaryKey,
  constraints

FROM information_schema.columns AS columns

JOIN pg_catalog.pg_attribute AS attributes
ON attributes.attrelid = columns.table_name::regclass
AND attributes.attname = columns.column_name
AND NOT attributes.attisdropped

LEFT JOIN pg_catalog.pg_index AS indexes
ON indexes.indrelid = attributes.attrelid
AND attributes.attnum = ANY(indexes.indkey)

LEFT JOIN (
  SELECT conrelid, conkey, array_agg(pg_get_expr(conbin, conrelid)) AS constraints
  FROM pg_catalog.pg_constraint
  WHERE contype = 'c'
  GROUP BY conrelid, conkey
) AS constraints
ON conrelid = attributes.attrelid
AND attributes.attnum = ANY(conkey)

WHERE columns.table_schema = 'public'
AND columns.table_name = '${name}'

ORDER BY ordinal_position