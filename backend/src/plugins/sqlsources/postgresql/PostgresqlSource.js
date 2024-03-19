import Handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import pg from 'pg';
import format from 'pg-format';
import { fileURLToPath } from 'url';
import { JSONSchemaToDatabase } from 'jsonschema2ddl';

const types = [
  'belongsTo',
  'has',
  'schema',
  'usedTables',
  'views',
];

function PostgresqlSource({ __name, constants, logger }) {

  Handlebars.registerHelper('loud', function (aString) {
    return aString.toUpperCase();
  });

  const connections = {};

  async function getConnection(connectionString) {
    logger.debug('connectionString:', connectionString);
    if (!connections[connectionString]) {
      connections[connectionString] = new pg.Client({ connectionString });
      await connections[connectionString].connect();
    }
    return connections[connectionString];
  }

  async function getData(source, limit, columns) {
    logger.debug('columns:', columns);
    const client = await getConnection(source.connectionString);
    let table;
    let dataset;
    if (source.tableName) {
      dataset = 'public';
      table = source.tableName;
    } else {
      dataset = source.dataset;
      const tables = source.tables.split(/\s*,\s*/);
      table = tables[0];
    }
    let selection = '*';
    if (columns) {
      selection = columns.join(', ');
    }
    const template = `SELECT ${selection} FROM "${dataset}"."${table}" LIMIT $1`;
    const query = fillTemplate(template, { dataset, table });
    logger.debug('query:', query);
    const { rows } = await client.query(
      query,
      [limit],
    );
    return rows;
  }

  async function getDataColumns(source, limit, columns) {
    const rows = await getData(source, limit, columns);
    const data = {};
    if (rows.length) {
      const columns = Object.keys(rows[0]);
      for (const col of columns) {
        data[col] = [];
      }
      for (const row of rows) {
        for (const col of columns) {
          data[col].push(row[col]);
        }
      }
    }
    return data;
  }

  /*
  function getDDLOpts(val) {
    switch (val.type) {
      case 'int':
        return { type: 'INTEGER' };

      case 'array':
        const { type } = getDDLOpts(val.items);
        return { mode: 'REPEATED', type };

      default:
        return { type: val.type.toUpperCase() };
    }
  }

  async function insertData(table, data, timeout) {
    let time;
    return new Promise((resolve, reject) => {
      const loop = async () => {
        try {
          await table.insert(data);
          resolve();
        } catch (err) {
          logger.debug(JSON.stringify(err));
          if (err.code === 404) {
            // table not ready yet, try again
            if (time > timeout) {
              reject();
            }
            time += 5000;
            setTimeout(loop, time);
          } else {
            reject();
          }
        }
      };
      loop();
    });
  }*/

  async function createTable(destination, data, schema, connectionString) {
    if (!data.length) {
      return;
    }
    // logger.debug('schema:', schema);
    const client = await getConnection(connectionString);
    const { dataset, tableName } = destination;

    const translator = new JSONSchemaToDatabase(schema, {
      database_flavor: 'postgres',
      db_schema_name: 'public',
      root_table_name: tableName,
    });
    await translator.create_tables(client, { auto_commit: true, drop_tables: true });

    // insert data
    const keys = Object.keys(data[0]);
    const rows = data.map(Object.values);
    const q = `INSERT INTO public."${tableName}" (${keys.join(', ')}) VALUES %L`;
    await client.query(format(q, rows));

    // const schema = Object.entries(inferredSchema.properties.required).map(([k, v]) => {
    //   const opts = getDDLOpts(v);
    //   return {
    //     name: k,
    //     ...opts,
    //   };
    // });
    // logger.debug('schema:', schema);

    // // TODO - copied from `BigQuerySource`
    // try {
    //   // delete table if exists
    //   client.query(`DROP TABLE "${dataset}"."${tableName}"`);
    // } catch (err) {
    //   console.error(err.message);
    //   // ignore
    // }
    // const [table] = await client
    //   .dataset(dataset)
    //   .createTable(tableName, { schema });

    // await insertData(table, data, 60000);

    logger.debug(`inserted ${data.length} rows`);
  }

  async function getMetadata(source) {
    logger.debug('get metadata for', source);
    const meta = {};
    try {
      const client = await getConnection(source.connectionString);
      // logger.debug('got client');
      const { rows } = await query(client, 'tables');
      for (const { name } of rows) {
        const proms = [];
        for (const type of types) {
          proms.push(query(client, type, { name }));
        }
        const resolved = await Promise.all(proms);
        meta[name] = resolved.reduce((a, v, i) => {
          a[types[i]] = v.rows;
          return a;
        }, {});
      }
      logger.debug('meta:', meta);
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      logger.error(message);
    }
    return meta;
  }

  function schemaToDDL(name, { schema }) {
    logger.debug('schema-to-ddl:', name, schema);
    const templateStr = `CREATE TABLE \`{{name}}\` ({{#each schema}}
    \`{{this.name}}\` {{loud this.type}}{{#if this.nullable}}{{else}} NOT NULL{{/if}}{{#if this.default}} DEFAULT {{this.default}}{{/if}},{{/each}}
)`;
    try {
      const template = Handlebars.compile(templateStr);
      return template({ name, schema });
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      logger.error(message);
      return '';
    }
  }

  async function getDDL(source) {
    logger.debug('get schema for', source);
    try {
      const meta = await getMetadata(source);
      const context = Object.entries(meta)
        .map(([name, meta]) => schemaToDDL(name, meta))
        .join('\n\n');
      logger.debug('context:', context);
      return context;
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      logger.error(message);
      return '';
    }
  }

  function getType(dataType) {
    switch (dataType.toLowerCase()) {
      case 'integer':
      case 'serial':
        return { type: 'integer' };

      case 'text':
        return { type: 'string' };

      case 'boolean':
      case 'bool':
        return { type: 'boolean' };

      case 'date':
        return { type: 'string', format: 'date' };

      case 'json':
        return { type: {} };

      default:
        if (/^(var)?char.*/.test(dataType)) {
          return { type: 'string' };
        }
        if (/^num.*/.test(dataType)) {
          return { type: 'number' };
        }
        if (/^dec.*/.test(dataType)) {
          return { type: 'number' };
        }
        return { type: 'string' };
    }
  }

  async function getSchema(source) {
    const meta = await getMetadata(source);
    const schemas = {};
    for (const [table, { schema }] of Object.entries(meta)) {
      const properties = {};
      for (const col of schema) {
        properties[col.name] = {
          ...getType(col.type),
        };
      }
      schemas[table] = {
        "$id": "https://promptstore.dev/table.schema.json",
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        properties,
        required: schema.filter(col => !col.nullable).map(col => col.name),
      };
    }
    return schemas;
  }

  async function getSample(source) {
    const client = await getConnection(source.connectionString);
    const limit = source.sampleRows || 10;
    const { rows } = await client.query(`SELECT * FROM ${source.tableName} LIMIT $1`, [limit]);
    return rows;
  }

  function fillTemplate(template, vars) {
    if (!template) {
      return null;
    }
    if (!vars) {
      return template;
    }
    try {
      template = template.replace(/\`/g, '\\`');
      const func = new Function(...Object.keys(vars), "return `" + template + "`;");
      return func(...Object.values(vars));
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      logger.error(message);
      return null;
    }
  };

  function query(client, type, vars) {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const filepath = `${__dirname}/sql/${type}.sql`;
    const template = fs.readFileSync(filepath).toString();
    const sql = fillTemplate(template, vars);
    logger.debug('sql:', sql);
    return client.query(sql);
  };

  return {
    __name,
    createTable,
    getData,
    getDataColumns,
    getSample,
    getDDL,
    getSchema,
  };

}

export default PostgresqlSource;
