const axios = require('axios');

function PIIService({ constants }) {

  async function scan(data) {
    const url = constants.PII_API_URL;
    const token = constants.HUGGING_FACE_TOKEN;
    const resp = await axios.post(url, { ...data, options: { wait_for_model: true } }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
    });
    return resp.data;
  }

  async function scan2(data) {
    const url = constants.PLAETOSEQ_PII_API_URL;
    const resp = await axios.post(url, { text: data.inputs }, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
    });
    return resp.data;
  }

  return {
    scan,
    scan2,
  };

}

module.exports = {
  PIIService,
};