import { BigQuery } from '@google-cloud/bigquery';
import isObject from 'lodash.isobject';

import { getInput } from '../../../utils';

function BigQueryTool({ __key, __name, constants, logger, services }) {

  const { executionsService } = services;

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

  async function call(args, raw) {
    try {
      const client = await getConnection();
      logger.debug('got client');
      const content = getInput(args);
      let { response, errors } = await executionsService.executeFunction({
        semanticFunctionName: 'generate_sql',
        args: { content, dialect: 'BigQuery' },
        params: { maxTokens: 512 },
        workspaceId: args.workspaceId,
        username: args.username,
      });
      if (errors) {
        logger.error(errors);
        return "I don't know how to answer that";
      }
      const { ambiguities, query } = JSON.parse(response.choices[0].message.content);
      logger.debug('query:', query);
      let [rows] = await client.query({ query });
      const recs = rows.map(row => {
        return Object.entries(row).reduce((a, [k, v]) => {
          if (isObject(v)) {  // convert date objects
            a[k] = v.value;
          } else {
            a[k] = v;
          }
          return a;
        }, {});
      });
      logger.debug('recs:', recs);
      if (raw) {
        return {
          content,
          query,
          ambiguities,
          records: recs,
        };
      }
      return getResultAsText(recs, ambiguities, content);
    } catch (err) {
      logger.error(err, err.stack);
      return raw ? [] : "I don't know how to answer that";
    }
  }

  function getResultAsText(recs, ambiguities, content) {
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
      if (ambiguities?.length) {
        suffix = '\n\nThe question and suggested result had the following ambiguities:\n- ' + ambiguities.join('\n- ');
      }
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
      description: constants.BIGQUERY_DESCRIPTION,
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
    __description: constants.BIGQUERY_DESCRIPTION,
    call,
    getOpenAPIMetadata,
  };
}

export default BigQueryTool;