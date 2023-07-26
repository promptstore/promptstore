const AnamlFeatureStore = require('./AnamlFeatureStore');

function AnamlService({ __name, constants, logger }) {

  async function getOnlineFeatures({
    appId,
    appSecret,
    featureStoreName,
    httpMethod,
    url,
  }, entityId) {
    const featureStore = new AnamlFeatureStore(constants, logger, url, appId, appSecret);
    const res = await featureStore.getFeatureValues(featureStoreName, entityId);
    return res.features;
  }

  return {
    __name,
    getOnlineFeatures,
  };
}

module.exports = AnamlService;
