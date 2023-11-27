import fs from 'fs';
import isObject from 'lodash.isobject';
import path from 'path';
import { BigQuery } from '@google-cloud/bigquery';
import { inferSchema } from '@jsonhero/schema-infer';
import { fileURLToPath } from 'url';

const types = [
  'columns',
];

function BigQuerySource({ __name, constants, logger }) {

  let connection;

  async function getConnection() {
    if (!connection) {
      connection = new BigQuery({
        keyFilename: constants.KEY_FILENAME,
        projectId: constants.PROJECT_ID,
      });
    }
    return connection;
  }

  async function getData(source, limit) {
    const client = await getConnection();
    const { dataset } = source;
    const tables = source.tables.split(/\s*,\s*/);
    const table = tables[0];
    const template = 'SELECT * FROM `${dataset}`.`${table}` LIMIT @limit';
    const query = fillTemplate(template, { dataset, table });
    logger.debug('query:', query);
    const [rows] = await client.query({
      query,
      params: { limit },
    });
    return rows.map(row => {
      return Object.entries(row).reduce((a, [k, v]) => {
        if (isObject(v)) {  // convert date objects
          a[k] = v.value;
        } else {
          a[k] = v;
        }
        return a;
      }, {});
    });
  }

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

  async function createTable(destination, data) {
    if (!data.length) {
      return;
    }
    const client = await getConnection();
    const { dataset, tableName } = destination;
    logger.debug('data:', data);
    const { inferredSchema } = inferSchema(data[0]);
    logger.debug('inferredSchema:', inferredSchema);
    const schema = Object.entries(inferredSchema.properties.required).map(([k, v]) => {
      const opts = getDDLOpts(v);
      return {
        name: k,
        ...opts,
      };
    });
    logger.debug('schema:', schema);
    try {
      // delete table if exists
      await client.dataset(dataset).table(tableName).delete();
    } catch (err) {
      console.warn(String(err));
      // ignore
    }
    const [table] = await client
      .dataset(dataset)
      .createTable(tableName, { schema });

    // this doesn't work - does it help?
    await untilTableExists(table, 60000);

    await insertData(table, data, 60000);

    logger.debug(`inserted ${data.length} rows`);
  }

  async function untilTableExists(table, timeout) {
    let time;
    return new Promise((resolve, reject) => {
      const loop = async () => {
        const exists = await table.exists();
        if (exists) {
          resolve();
        } else {
          if (time > timeout) {
            reject();
          }
          time += 5000;
          setTimeout(loop, time);
        }
      };
      loop();
    });
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
  }

  async function getSchema(source) {
    logger.debug('get schema for', source);
    try {
      const client = await getConnection();
      logger.debug('got client');
      const { dataset } = source;
      let [rows] = await query(client, 'tables', { dataset });

      // TODO
      if (source.tables) {
        const tables = source.tables
          .split(',')
          .map(table => table.trim())
          .filter(table => table);
        rows = rows.filter((row) => tables.includes(row.table_name));
      }

      const meta = {};
      for (const { table_name, ddl } of rows) {
        const proms = [];
        for (const type of types) {
          proms.push(query(client, type, { dataset, table_name }));
        }
        const resolved = await Promise.all(proms);
        meta[table_name] = resolved.reduce((a, v, i) => {
          a[types[i]] = v[0].map((row) => {
            return Object.entries(row).reduce((b, [k, v]) => {
              if (k === 'data_type') {
                let found;
                found = v.match(/ARRAY<(.*)>/);
                if (found) {
                  b.data_type = 'ARRAY';
                  b.items_type = found[1];
                } else {
                  found = v.match(/NUMERIC\((\d+),(\d+)\)/);
                  if (found) {
                    b.data_type = 'NUMERIC';
                    b.precision = +found[1];
                    b.scale = +found[2];
                  } else {
                    b.data_type = v;
                  }
                }
              } else {
                b[k] = v;
              }
              return b;
            }, {});
          });
          return a;
        }, {});
        meta[table_name].ddl = ddl;
      }
      logger.debug('meta:', meta);
      return meta;
    } catch (err) {
      logger.error(err, err.stack);
      return {};
    }
  }

  async function getDDL(source) {
    logger.debug('get ddl for', source);
    try {
      const meta = await getSchema(source);
      const context = Object.values(meta).map(v => v.ddl).join('\n\n');
      logger.debug('context:', context);
      return context;
    } catch (err) {
      logger.error(err);
      return '';
    }
  }

  async function getSample(source) {
    const client = await getConnection();
    const { dataset, sampleRows: limit = 10, tables } = source;
    const table = tables[0];
    const template = 'SELECT * FROM `${dataset}`.`${table}` LIMIT @limit'
    const query = fillTemplate(template, { dataset, table });
    const [rows] = await client.query({
      query,
      params: { limit },
    });
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
      console.error(err);
      return null;
    }
  };

  function query(client, type, vars, params) {
    logger.debug('vars:', vars);
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const filepath = `${__dirname}/sql/${type}.sql`;
    const template = fs.readFileSync(filepath).toString();
    const query = fillTemplate(template, vars);
    logger.debug('query:', query);
    return client.query({
      query,
      params,
    });
  };

  return {
    __name,
    createTable,
    getData,
    getDDL,
    getSample,
    getSchema,
  };

}

export default BigQuerySource;
