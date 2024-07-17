import { request, gql } from 'graphql-request';

function MetricsService({ __key, __name, constants, logger }) {

  async function call(input, raw, instance) {
    logger.debug('input:', input);
    logger.debug('raw:', raw);
    const url = 'http://0.0.0.0:4001/graphql';
    try {
      const { period } = input;
      const query = gql`
        query MyQuery {
          ${instance}(period: "${period}") {
            result
          }
        }
      `;
      const res = await request(url, query);
      logger.debug('res:', res);
      if (raw) {
        return res;
      }
      return res[instance].result;
    } catch (err) {
      const message = `Error evaluating input "${JSON.stringify(input)}":` + err.message;
      logger.error(message);
      if (raw) {
        return { error: { message } };
      }
      return message;
    }
  }

  function getOpenAPIMetadata() {
    // return {
    //   name: __key,
    //   description: constants.METRICS_DESCRIPTION,
    //   parameters: {
    //     properties: {
    //       metric: {
    //         description: 'Metric name.',
    //         type: 'string',
    //       },
    //       period: {
    //         description: "Period as week of the year using the format 'YYYY-WW'",
    //         type: 'string',
    //       },
    //     },
    //     required: ['metric', 'period'],
    //     type: 'object',
    //   },
    // };
    return [
      {
        name: __key + '__totalSalesVsBudget',
        description: 'Get the total sales vs budget metric',
        parameters: {
          properties: {
            period: {
              description: "Period as week of the year using the format 'YYYY-WW'",
              type: 'string',
            },
          },
          required: ['period'],
          type: 'object',
        },
      },
      {
        name: __key + '__conversionRate',
        description: 'Get the conversion rate metric',
        parameters: {
          properties: {
            period: {
              description: "Period as week of the year using the format 'YYYY-WW'",
              type: 'string',
            },
          },
          required: ['period'],
          type: 'object',
        },
      },
    ];
  }

  return {
    __name,
    __description: constants.METRICS_DESCRIPTION,
    call,
    getOpenAPIMetadata,
    multitool: true,
  };
}

export default MetricsService;