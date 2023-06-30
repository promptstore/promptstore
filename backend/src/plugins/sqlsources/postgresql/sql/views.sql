SELECT v.table_name AS name

FROM information_schema.views AS v

WHERE v.table_schema = 'public'

GROUP BY v.table_name