-- database, table, name, type, position, numeric_precision, numeric_precision_radix, numeric_scale, datetime_precision, is_in_primary_key
-- there are no primary keys

SELECT
  name
  ,type
FROM system.columns
WHERE table = '${name}'
AND database = '${database}'
ORDER BY position
