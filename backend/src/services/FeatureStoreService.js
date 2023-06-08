function FeatureStoreService({ logger, registry }) {

  async function getOnlineFeatures(featurestore, params, entityId) {
    const instance = registry[featurestore];
    return instance.getOnlineFeatures(params, entityId);
  };

  return {
    getOnlineFeatures,
  }

}

module.exports = {
  FeatureStoreService,
}