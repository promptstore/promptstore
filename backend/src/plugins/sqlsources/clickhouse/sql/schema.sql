SELECT
  name
  ,type
FROM system.columns
WHERE table = '${name}'
AND database = '${database}'
ORDER BY position
