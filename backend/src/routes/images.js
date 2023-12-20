import axios from 'axios';

export default ({ app, constants, logger }) => {

  app.get('/api/dev/images/*', async (req, res, next) => {
    const url = 'http://' + constants.S3_ENDPOINT + ':' + constants.S3_PORT + req.originalUrl.slice('/api/dev/images'.length);
    logger.debug('url:', url);
    const resp = await axios.get(url, {
      responseType: 'stream',
    });
    for (const key in resp.headers) {
      if (resp.headers.hasOwnProperty(key)) {
        const element = resp.headers[key];
        res.header(key, element);
      }
    }
    res.status(resp.status);
    resp.data.pipe(res);
  });

}