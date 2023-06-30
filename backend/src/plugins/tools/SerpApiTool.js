const axios = require('axios');

function SerpApiTool({ constants, logger }) {

  async function call(text) {
    const config = {
      method: 'post',
      url: constants.SERPAPI_URL,
      headers: {
        'X-API-KEY': constants.SERPAPI_KEY,
        'Content-Type': 'application/json'
      },
      data: JSON.stringify({ q: text }),
    };
    const res = await axios(config);
    return res.data;
  }

  return {
    call,
  };
}

module.exports = SerpApiTool;