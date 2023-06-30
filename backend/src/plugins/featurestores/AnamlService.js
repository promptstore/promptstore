const axios = require('axios');

const AnamlFeatureStore = require('./AnamlFeatureStore');

function AnamlService({ constants, logger }) {

  async function getOnlineFeatures({
    appId,
    appSecret,
    featureStoreName,
    httpMethod,
    url,
  }, entityId) {
    // logger.debug('url: ', url);
    const featureStore = new AnamlFeatureStore(constants, logger, url, appId, appSecret);
    const res = await featureStore.getFeatureValues(featureStoreName, entityId);
    return res.features;
  }

  return {
    getOnlineFeatures,
  };
}

module.exports = AnamlService;
