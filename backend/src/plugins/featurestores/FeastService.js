const axios = require('axios');

function FeastService() {

  async function getOnlineFeatures({
    appId,
    appSecret,
    entity,
    featureList = [],
    featureService,
    httpMethod,
    url,
  }, entityId) {
    const features = featureList.split(',').map(e => e.trim());
    const data = {
      features,
      entities: {
        [entity]: [entityId],
      },
    };
    const options = {
      method: httpMethod,
      url,
      data,
    };
    console.log('options:', options);
    const res = await axios(options);
    console.log('res:', res.data.results);
    const featureNames = features.map(f => f.split(':')[1]);
    return featureNames.reduce((a, f, i) => {
      a[f] = res.data.results[i + 1].values[0];
      return a;
    }, {});
  }

  return {
    getOnlineFeatures,
  };
}

module.exports = FeastService;
