SELECT name
FROM system.tables
WHERE database = '${database}'
ORDER BY name
