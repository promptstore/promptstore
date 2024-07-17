import { ClickHouse } from 'clickhouse';
import isObject from 'lodash.isobject';

import { getInput } from '../../../utils';

function ClickHouseTool({ __key, __name, constants, logger }) {

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
      const query = getInput(args);
      logger.debug('query:', query);
      let rows = await client.query(query).toPromise();
      logger.debug('rows:', rows)
      const data = rows.map(row => {
        return Object.entries(row).reduce((a, [k, v]) => {
          if (isObject(v)) {  // convert date objects
            a[k] = v.value;
          } else {
            a[k] = v;
          }
          return a;
        }, {});
      });
      logger.debug('data:', data);
      if (raw) {
        return { data };
      }
      return getResultAsText(data, query);
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

  function getResultAsText(recs, content) {
    if (recs.length) {
      let inline = true;
      let maxWords = 0;
      const texts = [];
      for (const rec of recs) {
        let text;
        if (Object.keys(rec).length === 1) {
          text = String(Object.values(rec)[0]);
          const numWords = text.split(/\s+/).length;
          maxWords = Math.max(maxWords, numWords);
        } else {
          inline = false;
          text = Object.entries(rec)
            .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
            .join('\n  ');
        }
        texts.push(text);
      }
      const prefix = `The answer to the question "${content}" is:`;
      let suffix = '';
      if (inline && maxWords < 6) {
        return prefix + ' ' + texts.join(', ') + suffix;
      }
      return prefix + '\n- ' + texts.join('\n- ') + suffix;
    }
    return "I don't know how to answer that";
  }

  function getOpenAPIMetadata() {
    return {
      name: __key,
      description: constants.CLICKHOUSE_DESCRIPTION,
      parameters: {
        properties: {
          content: {
            description: 'Input text',
            type: 'string',
          },
        },
        required: ['content'],
        type: 'object',
      },
    };
  }

  return {
    __name,
    __description: constants.CLICKHOUSE_DESCRIPTION,
    call,
    getOpenAPIMetadata,
  };

}

export default ClickHouseTool;
