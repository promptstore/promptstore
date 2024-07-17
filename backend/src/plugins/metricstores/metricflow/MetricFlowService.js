import axios from 'axios';
import pick from 'lodash.pick';

function MetricFlowService({ __name, constants, logger }) {

  const url = 'https://wp040.semantic-layer.us1.dbt.com/api/graphql';

  async function getMetrics({ environmentId, serviceToken }) {
    serviceToken ||= constants.METRICFLOW_SERVICE_TOKEN;
    environmentId ||= constants.METRICFLOW_ENVIRONMENT_ID;
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': 'Bearer ' + serviceToken,
    };
    const query = `{
      metrics(environmentId: ${environmentId}) {
        name
        description
        dimensions {
          name
          queryableGranularities
        }
        measures {
          name
          aggTimeDimension
        }
      }
    }`;
    const res = await axios.post(url, { query }, { headers });
    return res.data.data.metrics;
  }

  async function getMetricsForDimensions({ dimensions, environmentId, serviceToken }) {
    serviceToken ||= constants.METRICFLOW_SERVICE_TOKEN;
    environmentId ||= constants.METRICFLOW_ENVIRONMENT_ID;
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': 'Bearer ' + serviceToken,
    };
    const groupByInputs = dimensions.map(dim => pick(dim, ['name']));
    const query = `{
      metrics(environmentId: ${environmentId}, dimensions: ${JSON.stringify(groupByInputs)}) {
        name
        description
        dimensions {
          name
          queryableGranularities
        }
        measures {
          name
          aggTimeDimension
        }
      }
    }`;
    const res = await axios.post(url, { query }, { headers });
    return res.data.data.metrics;
  }

  async function getDimensions({ environmentId, metrics, serviceToken }) {
    serviceToken ||= constants.METRICFLOW_SERVICE_TOKEN;
    environmentId ||= constants.METRICFLOW_ENVIRONMENT_ID;
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': 'Bearer ' + serviceToken,
    };
    const metricInputs = metrics.map(m => pick(m, ['name']));
    const query = `{
      dimensions(environmentId: ${environmentId}, metrics: ${JSON.stringify(metricInputs)}) {
        name
        description
        queryableGranularities
      }
    }`;
    const res = await axios.post(url, { query }, { headers });
    return res.data.data.dimensions;
  }

  async function getMeasures({ environmentId, metrics, serviceToken }) {
    serviceToken ||= constants.METRICFLOW_SERVICE_TOKEN;
    environmentId ||= constants.METRICFLOW_ENVIRONMENT_ID;
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': 'Bearer ' + serviceToken,
    };
    const metricInputs = metrics.map(m => pick(m, ['name']));
    const query = `{
      measures(environmentId: ${environmentId}, metrics: ${JSON.stringify(metricInputs)}) {
        name
        description
        aggTimeDimension
      }
    }`;
    const res = await axios.post(url, { query }, { headers });
    return res.data.data.measures;
  }

  async function createQuery({ dimensions, environmentId, metrics, serviceToken }) {
    serviceToken ||= constants.METRICFLOW_SERVICE_TOKEN;
    environmentId ||= constants.METRICFLOW_ENVIRONMENT_ID;
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': 'Bearer ' + serviceToken,
    };
    const metricInputs = metrics.map(m => pick(m, ['name']));
    const groupByInputs = dimensions.map(dim => pick(dim, ['name']));
    const mutation = `{
      createQuery(environmentId: ${environmentId}, metrics: ${JSON.stringify(metricInputs)}, groupBy: ${JSON.stringify(groupByInputs)}) {
        queryId
      }
    }`;
    const res = await axios.post(url, { mutation }, { headers });
    return res.data.data.queryId;
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

  return {
    __name,
    getMetrics,
    getMetricsForDimensions,
    getDimensions,
    getMeasures,
    createQuery,
    getQueryResults,
  };
}

export default MetricFlowService;
