const FormData = require('form-data');
const axios = require('axios');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const { downloadImage } = require('../utils');

function CantoService({ constants, logger, mc }) {

  var accessToken;

  async function getUploadSetting(tokenData) {
    const url = `https://${tokenData.tenant}/api/v1/upload/setting`;
    const res = await axios.get(url, {
      headers: {
        'Authorization': tokenData.tokenType + ' ' + tokenData.accessToken,
      },
    });
    return res.data;
  }

  async function uploadFile(filename, filepath, fileSizeInBytes, setting) {
    logger.debug('filepath: ', filepath);

    const file = fs.createReadStream(filepath);

    const form = new FormData();
    form.append('key', setting.key);
    form.append('acl', setting.acl);
    form.append('AWSAccessKeyId', setting.AWSAccessKeyId);
    form.append('Policy', setting.Policy);
    form.append('Signature', setting.Signature);
    form.append('x-amz-meta-file_name', filename);
    form.append('x-amz-meta-tag', '');
    form.append('x-amz-meta-scheme', '');
    form.append('x-amz-meta-id', '');
    form.append('x-amz-meta-album_id', '');

    // Must include `refer=true` in upload settings request if used
    // form.append('x-amz-meta-refer_id', '');

    form.append('file', file, filename);

    // const res = await axios.post(setting.url, form, {
    //   headers: {
    //     ...form.getHeaders(),
    //     // 'Content-Length': fileSizeInBytes,
    //     'Content-Length': 787387,
    //   }
    // });
    // return res.data;

    try {
      const resp = await fetch(setting.url, {
        method: 'POST',
        body: form
      });
      logger.debug('resp: ', resp);
      return resp;
    } catch (err) {
      logger.error(err);
    }
  }

  async function getUploadStatus(tokenData) {
    const url = `https://${tokenData.tenant}/api/v1/upload/status?hours=1`;
    const res = await axios.get(url, {
      headers: {
        'Authorization': tokenData.tokenType + ' ' + tokenData.accessToken,
        'Content-Type': 'application/json',
      },
    });
    return res.data;
  }

  async function findImage(workspaceId, keywords, start = 0) {
    const keyword = keywords.map(encodeURIComponent).join('|');
    const url = `${constants.CANTO_SITE_BASEURL}/api/v1/search?keyword=${keyword}&scheme=image&limit=1&meta_choice_3=yes&start=${start}`;
    try {
      if (typeof accessToken === 'undefined') {
        const tokenData = await getAccessToken();
        logger.debug(tokenData);
        // await saveToken(tokenData);
        accessToken = tokenData.accessToken;
      }
      logger.debug('url: ', url);
      // logger.debug(`curl -vL -H 'Authorization: Bearer ${accessToken}' "${url}"`);
      const res = await axios.get(url, {
        headers: {
          'Accept': 'application/json;charset=UTF-8',
          'Authorization': `Bearer ${accessToken}`,
        }
      });
      logger.debug('res.data: ', res.data);
      const results = res.data.results;
      if (results && results.length) {
        const result = results[0];
        const url = result.additional['MDC App URL'];
        const dirname = path.join('/tmp/images/', String(workspaceId));
        await fs.promises.mkdir(dirname, { recursive: true });
        return await saveImage(workspaceId, dirname, result.name, url);
      }
      return null;
    } catch (err) {
      logger.error(String(err));
      throw err;
    }
  }

  async function saveImage(workspaceId, dirname, filename, url) {
    logger.debug('url: ', url);
    return new Promise(async (resolve, reject) => {
      const localFilePath = path.join(dirname, filename);
      try {
        await downloadImage(url, localFilePath);
      } catch (err) {
        logger.debug(String(err));
        reject(err);
      }
      const metadata = {
        'Content-Type': 'image/png',
      };
      const objectName = path.join(String(workspaceId), constants.IMAGES_PREFIX, filename);
      mc.fPutObject(constants.FILE_BUCKET, objectName, localFilePath, metadata, (err, etag) => {
        if (err) {
          logger.error(String(err));
          return reject(err);
        }
        mc.presignedUrl('GET', constants.FILE_BUCKET, objectName, 24 * 60 * 60, (err, presignedUrl) => {
          if (err) {
            logger.error(String(err));
            return reject(err);
          }
          let imageUrl;
          if (process.env.ENVIRON === 'dev') {
            const u = new URL(presignedUrl);
            imageUrl = '/api/dev/images' + u.pathname + u.search;
          } else {
            imageUrl = presignedUrl;
          }
          resolve({ imageUrl, objectName });
        });
      });
    });
  };

  async function getAccessToken() {
    const url = `${constants.CANTO_OAUTH_BASE_URL}/oauth/api/oauth2/token?app_id=${constants.CANTO_APP_ID}&app_secret=${constants.CANTO_APP_SECRET}&grant_type=client_credentials`;
    try {
      const res = await axios.post(url);
      return res.data;
    } catch (err) {
      logger.error(String(err));
      return null;
    }
  };

  async function saveToken(data) {
    const expires = new Date();
    expires.setDate(expires.getDate() + 29);
    const val = {
      accessToken: data.accessToken,
      expires: expires.toISOString(),
      tokenType: data.tokenType,
    };
    await pg.query(
      'INSERT INTO settings(key, val) VALUES($1, $2) RETURNING *',
      ['accessToken', val],
      (e, resp) => {
        if (e) {
          return logger.error(e);
        }
        logger.debug('Inserted ', resp.rows[0]);
      }
    );
  };

  async function loadToken(data) {
    await pg.query(
      'SELECT val FROM settings WHERE key = $1',
      ['accessToken'],
      (err, resp) => {
        if (err) {
          return logger.error(String(err));
        }
        logger.debug('Loaded ', resp);
      }
    );
  };


  return {
    findImage,
    getUploadSetting,
    getUploadStatus,
    saveImage,
    uploadFile,
  }
}

module.exports = {
  CantoService,
};