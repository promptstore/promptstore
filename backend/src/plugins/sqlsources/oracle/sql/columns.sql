SELECT owner AS table_schema,
       table_name,
       column_name
FROM all_tab_columns
WHERE LOWER(owner) NOT IN ('sys', 'system', 'sysaux', 'outln', 'xdb', 'ctxsys', 'dbsnmp', 'olapsys', 'ordplugins', 'ordsys', 'mdsys', 'oracle_odi', 'orddata', 'owbsys', 'si_informtn_schema', 'xs$null', 'appqossys', 'dip', 'ggsys', 'gsmadmin_internal', 'lbacsys', 'ojsys', 'orddata', 'wmsys')
AND table_name = '${table_name}'