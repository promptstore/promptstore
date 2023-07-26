const axios = require('axios');

function FeastService({ __name, constants, logger }) {

  /**
   * Example output:
   * 
   * {
   *   "metadata": {
   *     "feature_names": [
   *       "driver_id",
   *       "acc_rate",
   *       "conv_rate",
   *       "avg_daily_trips"
   *     ]
   *   },
   *   "results": [
   *     {
   *       "values": [
   *         1001
   *       ],
   *       "statuses": [
   *         "PRESENT"
   *       ],
   *       "event_timestamps": [
   *         "1970-01-01T00:00:00Z"
   *       ]
   *     },
   *     {
   *       "values": [
   *         0.8219879865646362
   *       ],
   *       "statuses": [
   *         "PRESENT"
   *       ],
   *       "event_timestamps": [
   *         "2023-06-05T13:00:00Z"
   *       ]
   *     },
   *     {
   *       "values": [
   *         0.08010909706354141
   *       ],
   *       "statuses": [
   *         "PRESENT"
   *       ],
   *       "event_timestamps": [
   *         "2023-06-05T13:00:00Z"
   *       ]
   *     },
   *     {
   *       "values": [
   *         412
   *       ],
   *       "statuses": [
   *         "PRESENT"
   *       ],
   *       "event_timestamps": [
   *         "2023-06-05T13:00:00Z"
   *       ]
   *     }
   *   ]
   * }
   * 
   * @param {*} param0 
   * @param {*} entityId 
   * @returns 
   */
  async function getOnlineFeatures({
    appId,
    appSecret,
    entity,
    featureList = [],
    featureService,
    httpMethod,
    url,
  }, entityId) {
    const data = {
      entities: {
        [entity]: [entityId],
      },
    };
    if (featureService) {
      data.feature_service = featureService;
    } else {
      data.features = featureList.split(',').map(e => e.trim());
    }
    const opts = {
      method: httpMethod.toUpperCase(),
      url,
      data,
    };
    logger.log('debug', 'opts:', opts);
    try {
      const res = await axios(opts);
      const featureNames = res.data.metadata.feature_names;
      return featureNames.reduce((a, f, i) => {
        a[f] = res.data.results[i].values[0];
        return a;
      }, {});
    } catch (err) {
      logger.log('error', String(err));
    }
  }

  return {
    __name,
    getOnlineFeatures,
  };
}

module.exports = FeastService;
