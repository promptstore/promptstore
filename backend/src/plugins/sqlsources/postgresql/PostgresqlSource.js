import pg from 'pg';
import Handlebars from 'handlebars';
import fs from 'fs';
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

  async function getSchema(source) {
    logger.debug('get schema for', source);
    try {
      const client = await getConnection(source.connectionString);
      logger.debug('got client');
      const { rows } = await query(client, 'tables');
      const meta = {};
      for (const { name } of rows) {
        const proms = [];
        for (const type of types) {
          proms.push(query(client, type, { name, database }));
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
    getSample,
    getSchema,
  };

}

export default PostgresqlSource;
