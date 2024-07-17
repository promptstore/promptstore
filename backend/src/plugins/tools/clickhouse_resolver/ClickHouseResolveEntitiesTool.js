import { ClickHouse } from 'clickhouse';
import { Minhash } from 'minhash';

function ClickHouseResolveEntitiesTool({ __key, __name, constants, logger }) {

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

  async function call(args, raw) {
    logger.debug('args:', args, 'raw:', raw);
    try {
      const client = await getConnection(constants.CLICKHOUSE_URL, constants.CLICKHOUSE_DATABASE, constants.CLICKHOUSE_USERNAME, constants.CLICKHOUSE_PASSWORD);
      const proposedValues = [];
      const alternativeValues = [];
      for (const { table, column, value } of args.whereConditions) {
        const values = await getCategoricalValues(client, table, column);
        const m1 = new Minhash();
        const s1 = value.split(/\s+/);
        s1.forEach(w => m1.update(w));
        const scores = [];
        for (const val of values) {
          const m2 = new Minhash();
          const s2 = val.split(/\s+/);
          s2.forEach(w => m2.update(w));
          const score = m1.jaccard(m2);
          scores.push([score, val]);
        }
        scores.sort((a, b) => a > b ? -1 : 1);
        // logger.debug('scores:', scores);
        proposedValues.push({
          originalValue: value,
          proposedValue: scores[0][1],
        });
        alternativeValues.push({
          originalValue: value,
          alternatives: scores.slice(1, 5).filter(s => s[0] > 0).map(s => s[1]),
        });
      }
      logger.debug('proposedValues:', proposedValues);
      logger.debug('alternativeValues:', alternativeValues);
      return { proposedValues, alternativeValues };
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      logger.error(message);
      if (raw) {
        return { ...args, error: err.message };
      }
      return "I don't know how to answer that";
    }
  }

  async function getCategoricalValues(client, table, column) {
    const sql = `SELECT DISTINCT ${column} FROM ${table}`;
    logger.debug('sql:', sql);
    const rows = await client.query(sql).toPromise();
    // logger.debug('rows:', rows);
    return rows.map(row => row[column]);
  }

  function getOpenAPIMetadata() {
    return {
      name: __key,
      description: constants.CLICKHOUSE_RESOLVE_ENTITIES_DESCRIPTION,
      parameters: {
        properties: {
          whereConditions: {
            description: 'WHERE conditions in a SQL query',
            type: 'array',
            items: {
              type: 'object',
              properties: {
                table: {
                  type: 'string',
                  description: 'Table name',
                },
                column: {
                  type: 'string',
                  description: 'Column name',
                },
                value: {
                  type: 'string',
                  description: 'Value',
                },
              }
            }
          },
        },
        required: ['content'],
        type: 'object',
      },
    };
  }

  return {
    __name,
    __description: constants.CLICKHOUSE_RESOLVE_ENTITIES_DESCRIPTION,
    call,
    getOpenAPIMetadata,
  };

}

export default ClickHouseResolveEntitiesTool;
