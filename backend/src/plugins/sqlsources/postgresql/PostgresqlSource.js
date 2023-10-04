import pg from 'pg';
import Handlebars from 'handlebars';
import fs from 'fs';
import { inferSchema } from '@jsonhero/schema-infer';
import path from 'path';
import { fileURLToPath } from 'url';

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
    if (!connections[connectionString]) {
      connections[connectionString] = new pg.Client({ connectionString });
      await connections[connectionString].connect();
    }
    return connections[connectionString];
  }

  async function getData(source, limit) {
    const client = await getConnection();
    const { dataset } = source;
    const tables = source.tables.split(/\s*,\s*/);
    const table = tables[0];
    const template = 'SELECT * FROM `${dataset}`.`${table}` LIMIT @limit';
    const query = fillTemplate(template, { dataset, table });
    logger.debug('query:', query);
    const [rows] = await client.query(
      query,
      [limit],
    );
    return rows;
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

  async function createTable(destination, data) {
    if (!data.length) {
      return;
    }
    const client = await getConnection();
    const { dataset, tableName } = destination;
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
      client.query(`DROP TABLE \`${dataset}\`.\`${tableName}\``);
    } catch (err) {
      console.error(err);
      // ignore
    }
    const [table] = await client
      .dataset(dataset)
      .createTable(tableName, { schema });

    await insertData(table, data, 60000);

    logger.debug(`inserted ${data.length} rows`);
  }

  async function getDDL(source) {
    logger.debug('get schema for', source);
    try {
      const client = await getConnection(source.connectionString);
      // logger.debug('got client');
      const { rows } = await query(client, 'tables');
      const meta = {};
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
      const context = Object.entries(meta).map(([name, meta]) => schemaToDDL(name, meta)).join('\n\n');
      logger.debug('context:', context);
      return context;
    } catch (err) {
      logger.error(err);
      return '';
    }
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
      logger.error(err);
      return '';
    }
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
      console.error(err);
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
    getData,
    getSample,
    getDDL,
  };

}

export default PostgresqlSource;
