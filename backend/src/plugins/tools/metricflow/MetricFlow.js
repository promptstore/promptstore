import axios from 'axios';
import pick from 'lodash.pick';

function MetricFlow({ __key, __name, constants, logger }) {

  const url = 'https://wp040.semantic-layer.us1.dbt.com/api/graphql';

  async function call(input) {
    logger.debug('evaluating input:', JSON.stringify(input));
    const environmentId = constants.METRICFLOW_ENVIRONMENT_ID;
    const serviceToken = constants.METRICFLOW_SERVICE_TOKEN;
    try {
      const { groupBy, metrics, orderBy, where } = input;
      let options = {
        dimensions: groupBy,
        environmentId,
        metrics,
        serviceToken,
      };
      logger.debug('options:', options);
      const queryId = await createQuery(options);
      logger.debug('queryId:', queryId);
      let i = 0;
      logger.debug('MAX_RETRIES:', constants.MAX_RETRIES);
      while (i < constants.MAX_RETRIES) {
        logger.debug('Try:', i + 1);
        const results = await getQueryResults({ environmentId, queryId, serviceToken });
        if (results.status === 'FAILED') {
          logger.error('Failed query:', results.error);
          return "I don't know how to do that.";
        }
        if (results.status === 'SUCCESSFUL') {
          const jsonResult = Buffer.from(results.jsonResult, 'base64').toString('utf-8');
          const json = JSON.parse(jsonResult);
          const table = convertToMarkdown(json);
          logger.debug('table:\n', table);
          return table;
        }
        i += 1;
        await delay(5000);
      }
      logger.error('Query timeout');
      return "I don't know how to do that.";
    } catch (err) {
      logger.error(`error evaluating input "${JSON.stringify(input)}":`, err.message);
      return "I don't know how to do that.";
    }
  }

  function convertToMarkdown(json) {
    const rows = [];
    const header = json.schema.fields.filter(f => f.name !== 'index').map(f => f.name).join(' | ');
    rows.push('| ' + header + ' |');
    const headerLine = json.schema.fields.filter(f => f.name !== 'index').map(() => '---').join(' | ');
    rows.push('| ' + headerLine + ' |');
    for (const data of json.data) {
      const row = Object.entries(data).filter(([k, _]) => k !== 'index').map(([_, v]) => v).join(' | ');
      rows.push('| ' + row + ' |');
    }
    return rows.join('\n');
  }

  async function createQuery({ dimensions, environmentId, metrics, serviceToken }) {
    serviceToken ||= constants.METRICFLOW_SERVICE_TOKEN;
    environmentId ||= constants.METRICFLOW_ENVIRONMENT_ID;
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': 'Bearer ' + serviceToken,
    };
    let metricInputs = metrics.map(m => pick(m, ['name']));
    metricInputs = JSON.stringify(metricInputs).replace(/"[^"]*":/g, (match) => match.replace(/"/g, ""));
    let groupByInputs = dimensions.map(dim => pick(dim, ['name']));
    groupByInputs = JSON.stringify(groupByInputs).replace(/"[^"]*":/g, (match) => match.replace(/"/g, ""));
    const query = `mutation {
      createQuery(environmentId: ${environmentId}, metrics: ${metricInputs}, groupBy: ${groupByInputs}) {
        queryId
      }
    }`;
    const res = await axios.post(url, { query }, { headers });
    return res.data.data.createQuery.queryId;
  }

  /**
   * Poll until status is 'FAILED' or 'SUCCESSFUL'
   * 
   * @param {*} param0 
   * @returns 
   */
  async function getQueryResults({ environmentId, queryId, serviceToken }) {
    serviceToken ||= constants.METRICFLOW_SERVICE_TOKEN;
    environmentId ||= constants.METRICFLOW_ENVIRONMENT_ID;
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': 'Bearer ' + serviceToken,
    };
    const query = `{
      query(environmentId: ${environmentId}, queryId: "${queryId}") {
        sql
        status
        error
        totalPages
        jsonResult
      }
    }`;
    const res = await axios.post(url, { query }, { headers });
    return res.data.data.query;
  }

  function getOpenAPIMetadata() {
    return {
      name: __key,
      description: constants.METRICFLOW_DESCRIPTION,
      parameters: {
        properties: {
          input: {
            description: 'Input query',
            type: 'string',
          },
        },
        required: ['input'],
        type: 'object',
      },
    };
  }

  const delay = (t) => {
    return new Promise((resolve) => {
      setTimeout(resolve, t);
    })
  };

  return {
    __name,
    __description: constants.METRICFLOW_DESCRIPTION,
    call,
    getOpenAPIMetadata,
  };
}

export default MetricFlow;