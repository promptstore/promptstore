import axios from 'axios';

function PIIService({ __name, __metadata, constants, logger, app, auth }) {

  async function scan(data) {
    const url = constants.HUGGINGFACE_PII_API_URL;
    const token = constants.HUGGINGFACE_TOKEN;
    const res = await axios.post(url, { ...data, options: { wait_for_model: true } }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
    });
    return res.data;
  }

  async function scan2(text) {
    const url = constants.EUROPA_PII_API_URL;
    const res = await axios.post(url, { text }, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
    });
    const resp = res.data.text;
    if (resp.match(/<[^>]+>/)) {
      return {
        error: {
          message: 'Detected PII',
        },
        text,
      };
    }
    return {
      text,
    };
  }

  if (app) {
    app.post('/api/pii', auth, async (req, res, next) => {
      const resp = await scan2(req.body);
      res.json(resp);
    });
  }

  return {
    __name,
    __metadata,
    scan: scan2,
  };

}

export default PIIService;
