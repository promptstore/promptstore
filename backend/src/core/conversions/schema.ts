enum ColumnDataType {
  STRING = 'STRING',
  INT64 = 'INT64',
  FLOAT64 = 'FLOAT64',
  NUMERIC = 'NUMERIC',
  BIGNUMERIC = 'BIGNUMERIC',
  BYTES = 'BYTES',
  BOOL = 'BOOL',
  DATE = 'DATE',
  TIME = 'TIME',
  TIMESTAMP = 'TIMESTAMP',
  INTERVAL = 'INTERVAL',
  ARRAY = 'ARRAY',
  JSON = 'JSON',
  STRUCT = 'STRUCT',
  GEOGRAPHY = 'GEOGRAPHY',
}

interface Column {
  table_catalog: string;
  table_schema: string;
  table_name: string;
  column_name: string;
  data_type: ColumnDataType;
  items_type?: ColumnDataType;
  precision?: number;
  scale?: number;
  is_nullable: boolean;
}

enum IndexFieldDataType {
  Vector = 'Vector',
  String = 'String',
  Integer = 'Integer',
  Numeric = 'Float',
  Boolean = 'Boolean',
}

interface IndexField {
  name: string;
  dataType: IndexFieldDataType;
  mandatory: boolean;
}

const columnToFieldMappings = {
  STRING: 'String',
  INT64: 'Integer',
  FLOAT64: 'Numeric',
  NUMERIC: 'Numeric',
  BIGNUMERIC: 'Numeric',
  BYTES: 'String',
  BOOL: 'Boolean',
  DATE: 'String',
  TIME: 'String',
  TIMESTAMP: 'String',
  INTERVAL: 'String',
  ARRAY: null,
  JSON: null,
  STRUCT: null,
  GEOGRAPHY: null,
};

export function columnToField(column: Column) {
  let dataType: IndexFieldDataType;
  if (column.data_type === ColumnDataType.ARRAY && column.items_type === ColumnDataType.FLOAT64) {
    dataType = IndexFieldDataType.Vector;
  } else {
    dataType = columnToFieldMappings[column.data_type];
  }
  return {
    name: column.column_name,
    dataType,
    mandatory: !column.is_nullable,
  };
}

export function columnsToFields(columns: Column[]) {
  return columns.reduce((a, col) => {
    a[col.column_name] = columnToField(col);
    return a;
  }, {})
}
