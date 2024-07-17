export function MetricStoreService({ logger, registry }) {

  async function getMetrics(metricstore, params) {
    logger.debug('metricstore:', metricstore);
    const instance = registry[metricstore];
    return instance.getMetrics(params);
  };

  async function getMetricsForDimensions(metricstore, params) {
    logger.debug('metricstore:', metricstore);
    const instance = registry[metricstore];
    return instance.getMetricsForDimensions(params);
  };

  async function getDimensions(metricstore, params) {
    logger.debug('metricstore:', metricstore);
    const instance = registry[metricstore];
    return instance.getDimensions(params);
  };

  async function getMeasures(metricstore, params) {
    logger.debug('metricstore:', metricstore);
    const instance = registry[metricstore];
    return instance.getMeasures(params);
  };

  async function createQuery(metricstore, params) {
    logger.debug('metricstore:', metricstore);
    const instance = registry[metricstore];
    return instance.createQuery(params);
  };

  async function getQueryResults(metricstore, params) {
    logger.debug('metricstore:', metricstore);
    const instance = registry[metricstore];
    return instance.getQueryResults(params);
  };

  return {
    getMetrics,
    getMetricsForDimensions,
    getDimensions,
    getMeasures,
    createQuery,
    getQueryResults,
  };

}
