import axios from 'axios';

function HuggingFaceService({ __name, constants, logger }) {

  async function getModels(q) {
    const url = constants.HUGGINGFACE_HUB_API + '/models?search=' + q;
    const res = await axios.get(url);
    return res.data;
  }

  async function query(model, args) {
    const url = constants.HUGGINGFACE_BASE_URL + '/' + model;
    const data = { inputs: args };
    const res = await axios.post(url, data, {
      headers: {
        'Authorization': 'Bearer ' + constants.HUGGINGFACE_TOKEN,
      },
    });
    return res.data;
  }

  return {
    __name,
    getModels,
    query,
  };

}

export default HuggingFaceService;
