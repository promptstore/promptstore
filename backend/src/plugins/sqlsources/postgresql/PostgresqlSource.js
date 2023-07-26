const { Client } = require('pg');
const Handlebars = require('handlebars');
const fs = require('fs');

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
      connections[connectionString] = new Client({ connectionString });
      await connections[connectionString].connect();
    }
    return connections[connectionString];
  }

  async function getSchema(source) {
    const client = await getConnection(source.connectionString);
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
    logger.debug('meta:', JSON.stringify(meta, null, 2));
    return Object.entries(meta).map(([name, meta]) => schemaToDDL(name, meta)).join('\n\n');
  }

  function schemaToDDL(name, { schema }) {
    logger.debug('schema-to-ddl:', name, JSON.stringify(schema, null, 2));
    const templateStr = `CREATE TABLE "{{name}} ({{#each schema}}
    "{{this.name}}" {{loud this.type}}{{#if this.nullable}}{{else}} NOT NULL{{/if}}{{#if this.default}} DEFAULT {{this.default}}{{/if}}{{/each}}
)`;
    const template = Handlebars.compile(templateStr);
    return template({ name, schema });
  }

  async function getSample(source, tableName, limit = 10) {
    const client = await getConnection(source.connectionString);
    const { rows } = await client.query(`SELECT * FROM ${tableName} LIMIT $1`, [limit]);
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
    const path = `${__dirname}/sql/${type}.sql`;
    const template = fs.readFileSync(path).toString();
    const sql = fillTemplate(template, vars);
    // logger.debug('sql:', sql);
    return client.query(sql);
  };

  return {
    __name,
    getSample,
    getSchema,
  };

}

module.exports = PostgresqlSource;