const axios = require('axios');

module.exports = ({ app, constants, logger }) => {

  app.get('/api/token', async (req, res, next) => {
    const { code } = req.query;
    logger.debug('');
    logger.debug('-------------------------------------------');
    logger.debug(`GET /api/token [code=${code}]`);
    const params = {
      app_id: constants.CANTO_USER_FLOW_APP_ID,
      app_secret: constants.CANTO_USER_FLOW_APP_SECRET,
      code,
      grant_type: 'authorization_code',
    };
    const url = constants.CANTO_AUTHORIZATION_SERVER_TOKEN_URL + '?' + objectToQuery(params);
    // logger.debug('url: ', url);
    const resp = await axios.post(url);
    // logger.debug('resp: ', resp.status + ' ' + JSON.stringify(resp.data, null, 2));
    res.send(resp.data);
  });

  const objectToQuery = (obj) => {
    const params = new URLSearchParams(obj);
    return String(params);
  };

};
