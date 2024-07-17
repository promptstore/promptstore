import axios from 'axios';

export function RulesEngineService({ constants, logger }) {

  async function deployRules(rulesetId, rules) {
    try {
      const url = constants.RULES_ENGINE_SERVICE_URL + '/rules';
      const res = await axios.post(url, {
        id: rulesetId,
        conditions: rules,
        branch: 'main',
      }, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });
      return res.data;
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      logger.error(message);
      throw err;
    }
  }

  async function run(data) {
    try {
      const url = constants.RULES_ENGINE_SERVICE_URL + '/run?branch=main';
      const res = await axios.post(url, data, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });
      return res.data;
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      logger.error(message);
      throw err;
    }
  }

  async function reset(data) {
    try {
      const url = constants.RULES_ENGINE_SERVICE_URL + '/reset';
      const res = await axios.post(url, null, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });
      return res.data;
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      logger.error(message);
      throw err;
    }
  }

  return {
    deployRules,
    reset,
    run,
  };
}