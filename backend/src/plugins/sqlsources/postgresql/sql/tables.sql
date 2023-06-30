SELECT
  t.table_name AS name
  , array_agg(ccu.column_name::text ORDER BY ccu.column_name COLLATE "C") AS "primaryKeys"

FROM information_schema.tables AS t

LEFT JOIN information_schema.table_constraints AS tc
ON tc.table_name = t.table_name AND tc.constraint_type = 'PRIMARY KEY'

LEFT JOIN information_schema.constraint_column_usage AS ccu
ON ccu.constraint_name = tc.constraint_name

WHERE t.table_schema = 'public'

GROUP BY t.table_name

ORDER BY t.table_name COLLATE "C"