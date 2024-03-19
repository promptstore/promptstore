import { ClickHouse } from 'clickhouse';
import Handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const types = [
  'schema',
];

const files = [
  'backend/src/plugins/sqlsources/clickhouse/json/fct_lineitems.json',
  'backend/src/plugins/sqlsources/clickhouse/json/fct_sales_by_location_day.json',
];

function ClickHouseSource({ __name, constants, logger }) {

  Handlebars.registerHelper('loud', function (aString) {
    return aString.toUpperCase();
  });

  const connections = {};

  async function getConnection(url, database, username, password) {
    if (!connections[url]) {
      const options = {
        url,
        port: 8123,
        debug: false,
        isUseGzip: false,
        trimQuery: false,
        usePost: false,
        format: 'json', // "json" || "csv" || "tsv"
        raw: false,
        config: {
          // session_id: 'session_id if neeed',
          // session_timeout: 60,
          // output_format_json_quote_64bit_integers: 0,
          // enable_http_compression: 0,
          database,
        },
      };
      if (username) {
        options.basicAuth = {
          username,
          password,
        };
      }
      connections[url] = new ClickHouse(options)
    }
    return connections[url];
  }

  async function getDDL(source) {
    const meta = {};
    for (const filepath of files) {
      const schema = loadJson(filepath);
      const name = filepath.split('/').pop().split('.')[0];
      meta[name] = { schema };
    }
    const context = Object.entries(meta).map(([name, meta]) => schemaToDDL(source.databaseName, name, meta)).join('\n\n');
    logger.debug('context:', context);
    return Promise.resolve(context);
  }

  async function getDDLX(source) {
    const { username, password } = source.credentials || {};
    const database = source.databaseName;
    const client = await getConnection(source.databaseHost, database, username, password);
    const rows = await query(client, 'tables', { database });
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
    return Object.entries(meta).map(([name, meta]) => schemaToDDL(name, meta)).join('\n\n');
  }

  function schemaToDDL(database, name, { schema }) {
    logger.debug('schema-to-ddl:', name, schema);
    const templateStr = `CREATE TABLE \`{{database}}\`.\`{{name}}\` ({{#each schema}}
    \`{{this.name}}\` {{loud this.type}}{{#if this.nullable}}{{else}} NOT NULL{{/if}}{{#if this.default}} DEFAULT {{this.default}}{{/if}},{{/each}}
)`;
    const template = Handlebars.compile(templateStr);
    return template({ database, name, schema });
  }

  async function getSample(source) {
    const { username, password } = source.credentials || {};
    const database = source.databaseName;
    const client = await getConnection(source.databaseHost, database, username, password);
    const limit = source.sampleRows || 10;
    const rows = await client.query(`SELECT * FROM ${source.tableName} LIMIT $1`, [limit]);
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
      console.error(message);
      return null;
    }
  };

  function query(client, type, vars) {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const filepath = `${__dirname}/sql/${type}.sql`;
    const template = fs.readFileSync(filepath).toString();
    const sql = fillTemplate(template, vars);
    // logger.debug('sql:', sql);
    return client.query(sql).toPromise();
  };

  return {
    __name,
    getSample,
    getDDL,
  };

}

function loadJson(filepath) {
  const raw = fs.readFileSync(filepath);
  return JSON.parse(raw);
}

export default ClickHouseSource;
