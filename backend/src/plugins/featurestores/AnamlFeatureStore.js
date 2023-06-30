const axios = require('axios');

class AnamlFeatureStore {

  constructor(constants, logger, url, apiKey, apiSecret) {
    this.logger = logger;
    // this.connectionParameters = {
    //   baseUrl: constants.ANAML_API_URL,
    //   apiKey: constants.ANAML_API_KEY,
    //   apiSecret: constants.ANAML_API_SECRET,
    // };
    this.connectionParameters = {
      baseUrl: url,
      apiKey,
      apiSecret,
    };
    logger.debug('connectionParameters: ', JSON.stringify(this.connectionParameters, null, 2));
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
    this.logger.debug('baseUrl: ', baseUrl);
    this.logger.debug('token: ', token);
    return { baseUrl, token };
  }

  async getDestinations() {
    this.logger.debug(`AnamlFeatureStore.getDestinations`);
    try {
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
      const res = await axios(opts);
      return JSON.parse(res.data);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  async getDestination(destinationId) {
    this.logger.debug(
      `AnamlFeatureStore.getDestination [` +
      `destinationId=${destinationId}]`);
    try {
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
      this.logger.debug('opts: ', opts);
      const res = await axios(opts);
      this.logger.debug('res: ', res.data);
      return JSON.parse(res.data);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  async getEntities() {
    this.logger.debug(`AnamlFeatureStore.getEntities`);
    try {
      const { baseUrl, token } = this.getParameters();
      const url = `${baseUrl}/entity`;
      const res = await axios({
        method: 'GET',
        url,
        headers: {
          'Authorization': 'Basic ' + token,
          'Accept': 'application/json',
        },
      });
      return JSON.parse(res.data);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  async getFeatureStores() {
    this.logger.debug(`AnamlFeatureStore.getFeatureStores`);
    try {
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
      const res = await axios(opts);
      const stores = JSON.parse(res.data);
      this.logger.debug('response example: ', JSON.stringify(stores[0], null, 2));
      return stores.filter((s) => s.enabled);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  async getFeatureStore(featureStoreId) {
    this.logger.debug(
      `AnamlFeatureStore.getFeatureStore [` +
      `featureStoreId=${featureStoreId}]`);
    const { baseUrl, token } = this.getParameters();
    try {
      const url = `${baseUrl}/feature-store/${featureStoreId}`;
      const res = await axios({
        method: 'GET',
        url,
        headers: {
          'Authorization': 'Basic ' + token,
          'Accept': 'application/json',
        }
      });
      return JSON.parse(res.data);
    } catch (err) {
      this.logger.debug(`curl -vL -H 'Accept: application/json' -H 'Authorization: Basic ${token}' "https://dev.anaml.app/api"`);
      return Promise.reject(err);
    }
  }

  async getFeatureSets() {
    this.logger.debug(`AnamlFeatureStore.getFeatureSets`);
    try {
      const { baseUrl, token } = this.getParameters();
      const url = `${baseUrl}/feature-set`;
      const res = await axios({
        method: 'GET',
        url,
        headers: {
          'Authorization': 'Basic ' + token,
          'Accept': 'application/json',
        }
      });
      return JSON.parse(res.data);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  async getFeatureSet(featureSetId) {
    this.logger.debug(
      `AnamlFeatureStore.getFeatureSet [` +
      `featureSetId=${featureSetId}]`);
    try {
      const { baseUrl, token } = this.getParameters();
      const url = `${baseUrl}/feature-set/${featureSetId}`;
      const res = await axios({
        method: 'GET',
        url,
        headers: {
          'Authorization': 'Basic ' + token,
          'Accept': 'application/json',
        }
      });
      return JSON.parse(res.data);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  async getAllFeatures() {
    this.logger.debug(
      `AnamlFeatureStore.getAllFeatures`);
    try {
      const { baseUrl, token } = this.getParameters();
      const url = `${baseUrl}/feature`;
      const res = await axios({
        method: 'GET',
        url,
        headers: {
          'Authorization': 'Basic ' + token,
          'Accept': 'application/json',
        }
      });
      return JSON.parse(res.data);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  async getFeatures(featureIdArray) {
    this.logger.debug(
      `AnamlFeatureStore.getFeatures [` +
      `featureIdArray=${featureIdArray}]`);
    try {
      const { baseUrl, token } = this.getParameters();
      const features = [];
      for (const id of featureIdArray) {
        const url = `${baseUrl}/feature/${id}`;
        const res = await axios({
          method: 'GET',
          url,
          headers: {
            'Authorization': 'Basic ' + token,
            'Accept': 'application/json',
          }
        });
        features.push(JSON.parse(res.data));
      }
      return features;
    } catch (err) {
      return Promise.reject(err);
    }
  }

  async getFeatureDetails(featureId) {
    this.logger.debug(
      `AnamlFeatureStore.getFeatureDetails [` +
      `featureId=${featureId}]`);
    try {
      const { baseUrl, token } = this.getParameters();
      const url = `${baseUrl}/feature/${featureId}/type`;
      const res = await axios({
        method: 'GET',
        url,
        headers: {
          'Authorization': 'Basic ' + token,
          'Accept': 'application/json',
        }
      });
      const details = JSON.parse(res.data);
      this.logger.debug(`feature details: (${featureId})`, JSON.stringify(details, null, 2));
      return details;
    } catch (err) {
      return Promise.reject(err);
    }
  }

  async getFeatureSample(featureIds) {
    this.logger.debug(
      `AnamlFeatureStore.getFeatureSample [` +
      `featureIds=${JSON.stringify(featureIds)}]`);
    try {
      const { baseUrl, token } = this.getParameters();
      const url = `${baseUrl}/feature-sample`;
      const res = await axios({
        method: 'POST',
        url,
        body: JSON.stringify({
          features: featureIds,
        }),
        headers: {
          'Authorization': 'Basic ' + token,
          'Accept': 'application/json',
        }
      });
      return JSON.parse(res.data);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  async getFeatureSetStatistics(featureSetId) {
    this.logger.debug(
      `AnamlFeatureStore.getFeatureSetStatistics [` +
      `featureSetId=${featureSetId}]`);
    try {
      const featureSet = await this.getFeatureSet(featureSetId);
      this.logger.debug('featureSet: ', featureSet);
      const { baseUrl, token } = this.getParameters();
      const url = `${baseUrl}/feature-set-preview`;
      const opts = {
        method: 'POST',
        url,
        body: JSON.stringify({ featureSet }),
        headers: {
          'Authorization': 'Basic ' + token,
          'Accept': 'application/json',
          'Accept': 'application/json',
        }
      };
      this.logger.debug('opts: ', JSON.stringify(opts, null, 2));
      const res = await axios(opts);
      const stats = JSON.parse(res.data);
      this.logger.debug(`feature set statistics (${featureSetId}): `, JSON.stringify(stats, null, 2));
      return stats;
    } catch (err) {
      return Promise.reject(err);
    }
  }

  // TODO
  // returning empty statistics
  async getFeatureStatistics(featureStore) {
    this.logger.debug(
      `AnamlFeatureStore.getFeatureStatistics [` +
      `featureStore=${featureStore}]`);
    try {
      const { baseUrl, token } = this.getParameters();
      const url = `${baseUrl}/feature-store/${featureStore}/run?num=1`;
      const res = await axios({
        method: 'GET',
        url,
        headers: {
          'Authorization': 'Basic ' + token,
          'Accept': 'application/json',
        }
      });
      const stats = JSON.parse(res.data);
      this.logger.debug(`feature statistics (${featureStore}): `, JSON.stringify(stats, null, 2));
      return stats;
    } catch (err) {
      return Promise.reject(err);
    }
  }

  async getFeatureStats(featureId) {
    this.logger.debug(
      `AnamlFeatureStore.getFeatureStats [` +
      `featureId=${featureId}]`);
    try {
      const features = await this.getFeatures([featureId]);
      const feature = features.data;
      const { baseUrl, token } = this.getParameters();
      const url = `${baseUrl}/feature-preview`;
      const res = await axios({
        method: 'POST',
        url,
        body: JSON.stringify({ feature }),
        headers: {
          'Authorization': 'Basic ' + token,
          'Accept': 'application/json',
          'Accept': 'application/json',
        }
      });
      const stats = JSON.parse(res.data);
      this.logger.debug(`feature stats (${featureId}): `, JSON.stringify(stats, null, 2));
      return stats;
    } catch (err) {
      return Promise.reject(err);
    }
  }

  async getFeatureValues(featureStore, entityId) {
    this.logger.debug(
      `AnamlFeatureStore.getFeatureValues [` +
      `featureStore=${featureStore}; entityId=${entityId}]`);
    try {
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
      this.logger.debug('opts: ', JSON.stringify(opts, null, 2));
      const res = await axios(opts);
      const values = res.data;
      this.logger.debug(`feature values (${featureStore}): `, JSON.stringify(values, null, 2));
      return values;
    } catch (err) {
      return Promise.reject(err);
    }
  }

  async getTables() {
    this.logger.debug(`AnamlFeatureStore.getTables`);
    try {
      const { baseUrl, token } = this.getParameters();
      const url = `${baseUrl}/table`;
      const res = await axios({
        method: 'GET',
        url,
        headers: {
          'Authorization': 'Basic ' + token,
          'Accept': 'application/json',
        },
      });
      return JSON.parse(res.data);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  async createFeatureStore(featureStoreInput) {
    this.logger.debug(`AnamlFeatureStore.createFeatureStore`);
    try {
      const { baseUrl, token } = this.getParameters();
      const url = `${baseUrl}/feature-store`;
      const opts = {
        method: 'POST',
        url,
        body: JSON.stringify({
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
        }),
        headers: {
          'Authorization': 'Basic ' + token,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }
      };
      const res = await axios(opts);
      return JSON.parse(res.data);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  async createFeatureSet(featureSetInput) {
    this.logger.debug(`AnamlFeatureStore.createFeatureSet`);
    try {
      const { baseUrl, token } = this.getParameters();
      const url = `${baseUrl}/feature-set`;
      const opts = {
        method: 'POST',
        url,
        body: JSON.stringify({
          attributes: [
            {
              key: 'Source System',
              value: 'Audience Builder',
            },
          ],
          labels: [
            'Decisioning',
          ],
          ...featureSetInput,
        }),
        headers: {
          'Authorization': 'Basic ' + token,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }
      };
      const res = await axios(opts);
      return JSON.parse(res.data);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  async createFeature(featureInput) {
    this.logger.debug(`AnamlFeatureStore.createFeature`);
    try {
      const { baseUrl, token } = this.getParameters();
      const url = `${baseUrl}/feature`;
      const opts = {
        method: 'POST',
        url,
        body: JSON.stringify({
          adt_type: 'row',
          attributes: [
            {
              key: 'Source System',
              value: 'Audience Builder',
            },
          ],
          labels: [
            'Decisioning',
          ],
          ...featureInput,
        }),
        headers: {
          'Authorization': 'Basic ' + token,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }
      };
      const res = await axios(opts);
      return JSON.parse(res.data);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  async updateFeatureStore(featureStoreId, featureStoreInput) {
    this.logger.debug(
      `AnamlFeatureStore.updateFeatureStore [` +
      `featureStoreId=${featureStoreId}]`);
    try {
      const { baseUrl, token } = this.getParameters();
      const url = `${baseUrl}/feature-store/${featureStoreId}`;
      const res = await axios({
        method: 'PUT',
        url,
        body: JSON.stringify({
          ...featureStoreInput,
        }),
        headers: {
          'Authorization': 'Basic ' + token,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }
      });
      return JSON.parse(res.data);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  async updateFeatureSet(featureSetId, featureSetInput) {
    this.logger.debug(
      `AnamlFeatureStore.updateFeatureSet [` +
      `featureSetId=${featureSetId}]`);
    try {
      const { baseUrl, token } = this.getParameters();
      const url = `${baseUrl}/feature-set/${featureSetId}`;
      const res = await axios({
        method: 'PUT',
        url,
        body: JSON.stringify({
          ...featureSetInput,
        }),
        headers: {
          'Authorization': 'Basic ' + token,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }
      });
      return JSON.parse(res.data);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  async runSchedule(featureStoreId) {
    this.logger.debug(`AnamlFeatureStore.createFeatureStore`);
    try {
      const { baseUrl, token } = this.getParameters();
      const url = `${baseUrl}/scheduler/run-immediate`;
      const date = new Date();
      const startDate = date.toISOString().split('T')[0];
      const res = await axios({
        method: 'POST',
        url,
        body: JSON.stringify({
          featureStoreId,
          dateRange: {
            startDate,
            endDate: startDate,
          },
        }),
        headers: {
          'Authorization': 'Basic ' + token,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }
      });
      return JSON.parse(res.data);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  async getRun(featureStoreId, runId) {
    this.logger.debug(
      `AnamlFeatureStore.getRun [` +
      `featureStoreId=${featureStoreId}; runId=${runId}]`);
    try {
      const { baseUrl, token } = this.getParameters();
      const url = `${baseUrl}/feature-store/${featureStoreId}/run/${runId}`;
      const res = await axios({
        method: 'GET',
        url,
        headers: {
          'Authorization': 'Basic ' + token,
          'Accept': 'application/json',
        }
      });
      return JSON.parse(res.data);
    } catch (err) {
      return Promise.reject(err);
    }
  }

}

module.exports = AnamlFeatureStore;
