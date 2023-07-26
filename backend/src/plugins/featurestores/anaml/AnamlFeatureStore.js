const axios = require('axios');

class AnamlFeatureStore {

  constructor(constants, logger, url, apiKey, apiSecret) {
    logger.debug('Construct Anaml Feature Store');
    this.logger = logger;
    this.connectionParameters = {
      baseUrl: url,
      apiKey,
      apiSecret,
    };
    // logger.debug('connection parameters:', this.connectionParameters);
    this.tokenCache = {};
  }

  getToken(apiKey, secret) {
    const cached = this.tokenCache[apiKey];
    if (cached) {
      return cached;
    }
    const data = apiKey + ':' + secret;
    const buff = Buffer.from(data);
    const token = buff.toString('base64');
    this.tokenCache[apiKey] = token;
    return token;
  }

  getParameters() {
    const { baseUrl, apiKey, apiSecret } = this.connectionParameters;
    const token = this.getToken(apiKey, apiSecret);
    return { baseUrl, token };
  }

  async getDestinations() {
    this.logger.debug(`AnamlFeatureStore.getDestinations`);
    const { baseUrl, token } = this.getParameters();
    const url = `${baseUrl}/destination`;
    const opts = {
      method: 'GET',
      url,
      headers: {
        'Authorization': 'Basic ' + token,
        'Accept': 'application/json',
      }
    };
    try {
      const res = await axios(opts);
      return JSON.parse(res.data);
    } catch (err) {
      this.logger.error(err);
      this.logger.debug(buildDebugCurlGet(url, token));
      return Promise.reject(err);
    }
  }

  async getDestination(destinationId) {
    this.logger.debug(
      `AnamlFeatureStore.getDestination [` +
      `destinationId=${destinationId}]`);
    const { baseUrl, token } = this.getParameters();
    const url = `${baseUrl}/destination/${destinationId}`;
    const opts = {
      method: 'GET',
      url,
      headers: {
        'Authorization': 'Basic ' + token,
        'Accept': 'application/json',
      }
    };
    try {
      const res = await axios(opts);
      return JSON.parse(res.data);
    } catch (err) {
      this.logger.error(err);
      this.logger.debug(buildDebugCurlGet(url, token));
      return Promise.reject(err);
    }
  }

  async getEntities() {
    this.logger.debug(`AnamlFeatureStore.getEntities`);
    const { baseUrl, token } = this.getParameters();
    const url = `${baseUrl}/entity`;
    const opts = {
      method: 'GET',
      url,
      headers: {
        'Authorization': 'Basic ' + token,
        'Accept': 'application/json',
      },
    };
    try {
      const res = await axios(opts);
      return JSON.parse(res.data);
    } catch (err) {
      this.logger.error(err);
      this.logger.debug(buildDebugCurlGet(url, token));
      return Promise.reject(err);
    }
  }

  async getFeatureStores() {
    this.logger.debug(`AnamlFeatureStore.getFeatureStores`);
    const { baseUrl, token } = this.getParameters();
    const url = `${baseUrl}/feature-store`;
    const opts = {
      method: 'GET',
      url,
      headers: {
        'Authorization': 'Basic ' + token,
        'Accept': 'application/json',
      }
    };
    try {
      const res = await axios(opts);
      const stores = JSON.parse(res.data);
      if (stores.length) {
        this.logger.debug('response example:', stores[0]);
      }
      return stores.filter((s) => s.enabled);
    } catch (err) {
      this.logger.error(err);
      this.logger.debug(buildDebugCurlGet(url, token));
      return Promise.reject(err);
    }
  }

  async getFeatureStore(featureStoreId) {
    this.logger.debug(
      `AnamlFeatureStore.getFeatureStore [` +
      `featureStoreId=${featureStoreId}]`);
    const { baseUrl, token } = this.getParameters();
    const url = `${baseUrl}/feature-store/${featureStoreId}`;
    const opts = {
      method: 'GET',
      url,
      headers: {
        'Authorization': 'Basic ' + token,
        'Accept': 'application/json',
      }
    };
    try {
      const res = await axios(opts);
      return JSON.parse(res.data);
    } catch (err) {
      this.logger.error(err);
      this.logger.debug(buildDebugCurlGet(url, token));
      return Promise.reject(err);
    }
  }

  async getFeatureSets() {
    this.logger.debug(`AnamlFeatureStore.getFeatureSets`);
    const { baseUrl, token } = this.getParameters();
    const url = `${baseUrl}/feature-set`;
    const opts = {
      method: 'GET',
      url,
      headers: {
        'Authorization': 'Basic ' + token,
        'Accept': 'application/json',
      }
    };
    try {
      const res = await axios(opts);
      return JSON.parse(res.data);
    } catch (err) {
      this.logger.error(err);
      this.logger.debug(buildDebugCurlGet(url, token));
      return Promise.reject(err);
    }
  }

  async getFeatureSet(featureSetId) {
    this.logger.debug(
      `AnamlFeatureStore.getFeatureSet [` +
      `featureSetId=${featureSetId}]`);
    const { baseUrl, token } = this.getParameters();
    const url = `${baseUrl}/feature-set/${featureSetId}`;
    const opts = {
      method: 'GET',
      url,
      headers: {
        'Authorization': 'Basic ' + token,
        'Accept': 'application/json',
      }
    };
    try {
      const res = await axios(opts);
      return JSON.parse(res.data);
    } catch (err) {
      this.logger.error(err);
      this.logger.debug(buildDebugCurlGet(url, token));
      return Promise.reject(err);
    }
  }

  async getAllFeatures() {
    this.logger.debug(`AnamlFeatureStore.getAllFeatures`);
    const { baseUrl, token } = this.getParameters();
    const url = `${baseUrl}/feature`;
    const opts = {
      method: 'GET',
      url,
      headers: {
        'Authorization': 'Basic ' + token,
        'Accept': 'application/json',
      }
    };
    try {
      const res = await axios(opts);
      return JSON.parse(res.data);
    } catch (err) {
      this.logger.error(err);
      this.logger.debug(buildDebugCurlGet(url, token));
      return Promise.reject(err);
    }
  }

  async getFeatures(featureIdArray) {
    this.logger.debug(
      `AnamlFeatureStore.getFeatures [` +
      `featureIdArray=${featureIdArray}]`);
    const { baseUrl, token } = this.getParameters();
    const features = [];
    let url, opts;
    try {
      for (const id of featureIdArray) {
        url = `${baseUrl}/feature/${id}`;
        opts = {
          method: 'GET',
          url,
          headers: {
            'Authorization': 'Basic ' + token,
            'Accept': 'application/json',
          }
        };
        const res = await axios(opts);
        features.push(JSON.parse(res.data));
      }
      return features;
    } catch (err) {
      this.logger.error(err);
      this.logger.debug(buildDebugCurlGet(url, token));
      return Promise.reject(err);
    }
  }

  async getFeatureDetails(featureId) {
    this.logger.debug(
      `AnamlFeatureStore.getFeatureDetails [` +
      `featureId=${featureId}]`);
    const { baseUrl, token } = this.getParameters();
    const url = `${baseUrl}/feature/${featureId}/type`;
    const opts = {
      method: 'GET',
      url,
      headers: {
        'Authorization': 'Basic ' + token,
        'Accept': 'application/json',
      }
    };
    try {
      const res = await axios(opts);
      return JSON.parse(res.data);
    } catch (err) {
      this.logger.error(err);
      this.logger.debug(buildDebugCurlGet(url, token));
      return Promise.reject(err);
    }
  }

  async getFeatureSample(featureIds) {
    this.logger.debug(
      `AnamlFeatureStore.getFeatureSample [` +
      `featureIds=${JSON.stringify(featureIds)}]`);
    const { baseUrl, token } = this.getParameters();
    const url = `${baseUrl}/feature-sample`;
    const opts = {
      method: 'POST',
      url,
      body: JSON.stringify({
        features: featureIds,
      }),
      headers: {
        'Authorization': 'Basic ' + token,
        'Accept': 'application/json',
      }
    };
    try {
      const res = await axios(opts);
      return JSON.parse(res.data);
    } catch (err) {
      this.logger.error(err);
      this.logger.debug(buildDebugCurlGet(url, token));
      return Promise.reject(err);
    }
  }

  async getFeatureSetStatistics(featureSetId) {
    this.logger.debug(
      `AnamlFeatureStore.getFeatureSetStatistics [` +
      `featureSetId=${featureSetId}]`);
    const { baseUrl, token } = this.getParameters();
    const url = `${baseUrl}/feature-set-preview`;
    let opts;
    try {
      const featureSet = await this.getFeatureSet(featureSetId);
      this.logger.debug('featureSet:', featureSet);
      opts = {
        method: 'POST',
        url,
        body: JSON.stringify({ featureSet }),
        headers: {
          'Authorization': 'Basic ' + token,
          'Accept': 'application/json',
          'Accept': 'application/json',
        }
      };
      const res = await axios(opts);
      return JSON.parse(res.data);
    } catch (err) {
      this.logger.error(err);
      this.logger.debug(buildDebugCurlGet(url, token));
      return Promise.reject(err);
    }
  }

  // TODO
  // returning empty statistics - API has changed I think
  async getFeatureStatistics(featureStore) {
    this.logger.debug(
      `AnamlFeatureStore.getFeatureStatistics [` +
      `featureStore=${featureStore}]`);
    const { baseUrl, token } = this.getParameters();
    const url = `${baseUrl}/feature-store/${featureStore}/run?num=1`;
    const opts = {
      method: 'GET',
      url,
      headers: {
        'Authorization': 'Basic ' + token,
        'Accept': 'application/json',
      }
    };
    try {
      const res = await axios(opts);
      return JSON.parse(res.data);
    } catch (err) {
      this.logger.error(err);
      this.logger.debug(buildDebugCurlGet(url, token));
      return Promise.reject(err);
    }
  }

  async getFeatureStats(featureId) {
    this.logger.debug(
      `AnamlFeatureStore.getFeatureStats [` +
      `featureId=${featureId}]`);
    const { baseUrl, token } = this.getParameters();
    const url = `${baseUrl}/feature-preview`;
    let opts;
    try {
      const features = await this.getFeatures([featureId]);
      const feature = features.data;
      opts = {
        method: 'POST',
        url,
        body: JSON.stringify({ feature }),
        headers: {
          'Authorization': 'Basic ' + token,
          'Accept': 'application/json',
          'Accept': 'application/json',
        }
      };
      const res = await axios(opts);
      return JSON.parse(res.data);
    } catch (err) {
      this.logger.error(err);
      this.logger.debug(buildDebugCurlGet(url, token));
      return Promise.reject(err);
    }
  }

  async getFeatureValues(featureStore, entityId) {
    this.logger.debug(
      `AnamlFeatureStore.getFeatureValues [` +
      `featureStore=${featureStore}; entityId=${entityId}]`);
    const { baseUrl, token } = this.getParameters();
    const url = `${baseUrl}/generated-feature/${featureStore}/${entityId}`;
    const opts = {
      method: 'GET',
      url,
      headers: {
        'Authorization': 'Basic ' + token,
        'Accept': 'application/json',
      }
    };
    try {
      const res = await axios(opts);
      return res.data;
    } catch (err) {
      this.logger.error(err);
      this.logger.debug(buildDebugCurlGet(url, token));
      return Promise.reject(err);
    }
  }

  async getTables() {
    this.logger.debug(`AnamlFeatureStore.getTables`);
    const { baseUrl, token } = this.getParameters();
    const url = `${baseUrl}/table`;
    const opts = {
      method: 'GET',
      url,
      headers: {
        'Authorization': 'Basic ' + token,
        'Accept': 'application/json',
      },
    };
    try {
      const res = await axios(opts);
      return JSON.parse(res.data);
    } catch (err) {
      this.logger.error(err);
      this.logger.debug(buildDebugCurlGet(url, token));
      return Promise.reject(err);
    }
  }

  async createFeatureStore(featureStoreInput) {
    this.logger.debug(`AnamlFeatureStore.createFeatureStore`);
    const { baseUrl, token } = this.getParameters();
    const url = `${baseUrl}/feature-store`;
    const data = {
      adt_type: 'batch',
      attributes: [],
      cluster: 2,
      enabled: true,
      includeMetadata: false,
      labels: [
        'Decisioning',
      ],
      schedule: {
        adt_type: 'never',
      },
      ...featureStoreInput,
    };
    const opts = {
      method: 'POST',
      url,
      body: JSON.stringify(data),
      headers: {
        'Authorization': 'Basic ' + token,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
    };
    try {
      const res = await axios(opts);
      return JSON.parse(res.data);
    } catch (err) {
      this.logger.error(err);
      this.logger.debug(buildDebugCurlPost(url, token, data));
      return Promise.reject(err);
    }
  }

  async createFeatureSet(featureSetInput) {
    this.logger.debug(`AnamlFeatureStore.createFeatureSet`);
    const { baseUrl, token } = this.getParameters();
    const url = `${baseUrl}/feature-set`;
    const data = {
      attributes: [
        {
          key: 'Source System',
          value: 'Prompt Store',
        },
      ],
      labels: [
        'Decisioning',
      ],
      ...featureSetInput,
    };
    const opts = {
      method: 'POST',
      url,
      body: JSON.stringify(data),
      headers: {
        'Authorization': 'Basic ' + token,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
    };
    try {
      const res = await axios(opts);
      return JSON.parse(res.data);
    } catch (err) {
      this.logger.error(err);
      this.logger.debug(buildDebugCurlPost(url, token, data));
      return Promise.reject(err);
    }
  }

  async createFeature(featureInput) {
    this.logger.debug(`AnamlFeatureStore.createFeature`);
    const { baseUrl, token } = this.getParameters();
    const url = `${baseUrl}/feature`;
    const data = {
      adt_type: 'row',
      attributes: [
        {
          key: 'Source System',
          value: 'Prompt Store',
        },
      ],
      labels: [
        'Decisioning',
      ],
      ...featureInput,
    };
    const opts = {
      method: 'POST',
      url,
      body: JSON.stringify(data),
      headers: {
        'Authorization': 'Basic ' + token,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
    };
    try {
      const res = await axios(opts);
      return JSON.parse(res.data);
    } catch (err) {
      this.logger.error(err);
      this.logger.debug(buildDebugCurlPost(url, token, data));
      return Promise.reject(err);
    }
  }

  async updateFeatureStore(featureStoreId, featureStoreInput) {
    this.logger.debug(
      `AnamlFeatureStore.updateFeatureStore [` +
      `featureStoreId=${featureStoreId}]`);
    const { baseUrl, token } = this.getParameters();
    const url = `${baseUrl}/feature-store/${featureStoreId}`;
    const opts = {
      method: 'PUT',
      url,
      body: JSON.stringify(featureStoreInput),
      headers: {
        'Authorization': 'Basic ' + token,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
    };
    try {
      const res = await axios(opts);
      return JSON.parse(res.data);
    } catch (err) {
      this.logger.error(err);
      this.logger.debug(buildDebugCurlPut(url, token, featureStoreInput));
      return Promise.reject(err);
    }
  }

  async updateFeatureSet(featureSetId, featureSetInput) {
    this.logger.debug(
      `AnamlFeatureStore.updateFeatureSet [` +
      `featureSetId=${featureSetId}]`);
    const { baseUrl, token } = this.getParameters();
    const url = `${baseUrl}/feature-set/${featureSetId}`;
    const opts = {
      method: 'PUT',
      url,
      body: JSON.stringify(featureSetInput),
      headers: {
        'Authorization': 'Basic ' + token,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
    };
    try {
      const res = await axios(opts);
      return JSON.parse(res.data);
    } catch (err) {
      this.logger.error(err);
      this.logger.debug(buildDebugCurlPut(url, token, featureSetInput));
      return Promise.reject(err);
    }
  }

  async runSchedule(featureStoreId) {
    this.logger.debug(`AnamlFeatureStore.createFeatureStore`);
    const { baseUrl, token } = this.getParameters();
    const url = `${baseUrl}/scheduler/run-immediate`;
    const date = new Date();
    const startDate = date.toISOString().split('T')[0];
    const data = {
      featureStoreId,
      dateRange: {
        startDate,
        endDate: startDate,
      },
    };
    const opts = {
      method: 'POST',
      url,
      body: JSON.stringify(data),
      headers: {
        'Authorization': 'Basic ' + token,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
    };
    try {
      const res = await axios(opts);
      return JSON.parse(res.data);
    } catch (err) {
      this.logger.error(err);
      this.logger.debug(buildDebugCurlPost(url, token, data));
      return Promise.reject(err);
    }
  }

  async getRun(featureStoreId, runId) {
    this.logger.debug(
      `AnamlFeatureStore.getRun [` +
      `featureStoreId=${featureStoreId}; runId=${runId}]`);
    const { baseUrl, token } = this.getParameters();
    const url = `${baseUrl}/feature-store/${featureStoreId}/run/${runId}`;
    const opts = {
      method: 'GET',
      url,
      headers: {
        'Authorization': 'Basic ' + token,
        'Accept': 'application/json',
      }
    };
    try {
      const res = await axios(opts);
      return JSON.parse(res.data);
    } catch (err) {
      this.logger.error(err);
      this.logger.debug(buildDebugCurlGet(url, token));
      return Promise.reject(err);
    }
  }

}

const buildDebugCurlGet = (url, token) => {
  return `curl -vL -H 'Accept: application/json' -H 'Authorization: Basic ${token}' "${url}"`;
};

const buildDebugCurlPost = (url, token, data) => {
  return `curl -vL -H 'Accept: application/json' -H 'Authorization: Basic ${token}' -H 'Content-Type: application/json' "${url}" --data '${JSON.stringify(data)}'`;
};

const buildDebugCurlPut = (url, token, data) => {
  return `curl -vL -X PUT -H 'Accept: application/json' -H 'Authorization: Basic ${token}' -H 'Content-Type: application/json' "${url}" --data '${JSON.stringify(data)}'`;
};

module.exports = AnamlFeatureStore;
