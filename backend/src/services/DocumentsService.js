const FormData = require('form-data');
const axios = require('axios');
// const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

function DocumentsService({ constants, mc, logger }) {

  async function extract(file) {
    try {
      const data = await fs.promises.readFile(file.path);
      const form = new FormData();
      form.append('file', data, {
        filename: file.originalname,
        contentType: 'application/pdf',
      });
      const res = await axios.post(constants.ONESOURCE_API_URL, form, {
        headers: form.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });
      logger.debug('File uploaded to document service successfully.');
      logger.debug('res: ', res.data);
      return res.data;
    } catch (err) {
      logger.error(err);
      return null;
    }
    // const opt = {
    //   method: 'POST',
    //   body: stream,
    //   redirect: 'manual',
    // };
    // logger.debug('opt: ', opt);
    // const res = await fetch(constants.ONESOURCE_API_URL, opt);
    // logger.debug('res: ', res);
    // logger.debug('status: ', res.status);
    // logger.debug('headers: ', res.headers);
    // if (res.status === 301 || res.status === 302) {
    //   const locationURL = new URL(res.headers.get('location'), res.url);
    //   logger.debug('locationURL: ', locationURL);
    //   const res2 = await fetch(locationURL, { redirect: 'manual' });
    //   const data = res2.json();
    //   logger.debug('data: ', data);
    //   return data;
    // }
    // return null;
  }

  function read(filepath, maxBytes = 0, transformation, options) {
    return new Promise((resolve, reject) => {
      const localFilePath = `/tmp/${constants.FILE_BUCKET}/${filepath}`;
      const dirname = path.dirname(localFilePath);
      fs.mkdirSync(dirname, { recursive: true });
      const fileStream = fs.createWriteStream(localFilePath);
      mc.getPartialObject(constants.FILE_BUCKET, filepath, 0, maxBytes, async (err, dataStream) => {
        if (err) {
          logger.error(err);
          reject(err);
        }
        dataStream.on('data', (chunk) => {
          fileStream.write(chunk);
        });
        dataStream.on('end', () => {
          const contents = fs.readFileSync(localFilePath, { encoding: 'utf-8' });
          // logger.debug('contents: ', contents);
          if (typeof transformation === 'function') {
            const output = transformation(contents, options);
            // logger.debug('output: ', output);
            resolve(output);
          } else {
            resolve(contents);
          }
        });
      });
    });
  }

  const transformations = {
    csv: (text, options) => {
      // strip last maybe malformed record
      const index = text.lastIndexOf('\n');
      const input = text.slice(0, index);
      // logger.debug('input: ', input);
      return parse(input, options);
    },
  };

  return {
    extract,
    read,
    transformations,
  };

}

module.exports = {
  DocumentsService,
}