const axios = require('axios');

function HuggingFaceService({ constants, logger }) {

  async function query(model, args) {
    const url = constants.HUGGING_FACE_BASE_URL + '/' + model;
    const data = { inputs: args };
    const resp = await axios.post(url, data, {
      headers: {
        'Authorization': 'Bearer ' + constants.HUGGING_FACE_TOKEN,
      },
    });
    return resp.data;
  }

  async function getModels(q) {
    const url = constants.HUGGING_FACE_HUB_API + '/models?search=' + q;
    const resp = await axios.get(url);
    return resp.data;
  }

  return {
    getModels,
    query,
  };

}

module.exports = {
  HuggingFaceService,
};
