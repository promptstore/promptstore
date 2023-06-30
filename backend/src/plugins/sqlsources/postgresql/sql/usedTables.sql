SELECT
  vtu.table_name AS name

FROM information_schema.view_table_usage AS vtu

WHERE vtu.view_name='${name}'