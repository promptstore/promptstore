export function FeatureStoreService({ logger, registry }) {

  async function getOnlineFeatures(featurestore, params, entityId) {
    logger.debug('featurestore:', featurestore);
    const instance = registry[featurestore];
    return instance.getOnlineFeatures(params, entityId);
  };

  return {
    getOnlineFeatures,
  }

}
