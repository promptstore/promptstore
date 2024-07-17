SELECT tabschema AS table_schema,
       tabname AS table_name,
       colname AS column_name
FROM SYSCAT.COLUMNS
WHERE LOWER(tabschema) NOT IN ('syscat', 'sysibm', 'sysibmadm', 'sysibmtopology', 'syspublic', 'sysproc', 'syssh200', 'systools')
AND tabname = '${table_name}'