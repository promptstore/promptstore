import axios from 'axios';
import fs from 'fs';
import path from 'path';
import uuid from 'uuid';
import { convert } from 'html-to-text';

function GoogleSearchLoader({ __name, constants, logger }) {

  async function search(query, limit) {
    const config = {
      method: 'post',
      url: constants.SERPAPI_URL,
      headers: {
        'X-API-KEY': constants.SERPAPI_KEY,
        'Content-Type': 'application/json'
      },
      data: JSON.stringify({ q: query, num: limit }),
    };
    const res = await axios(config);
    return res.data.organic;
  }

  function generateNameFromUrl(url) {
    const uri = new URL(url);
    let name = uri.hostname + uri.pathname;
    return name.replace(/[\.\/-]+/g, '_');
  }

  async function getPage(link) {
    const res = await axios.get(link);
    return convert(res.data);
  }

  async function load({
    dataSourceId,
    dataSourceName,
    objectNames,
    bucket,
    prefix,
    recursive,
    query,
    limit = 10,
    maxBytes = 0,
  }) {
    const proms = [];
    if (!objectNames) {
      let objects = await search(query, limit);
      objectNames = objects
        .map(obj => ({
          objectName: generateNameFromUrl(obj.link),
          title: obj.title,
          link: obj.link,
        }));
    }
    logger.debug('objectNames:', objectNames)
    bucket = bucket || constants.FILE_BUCKET;
    for (let { link, objectName, title, uploadId } of objectNames) {
      try {
        const prom = new Promise(async (resolve, reject) => {
          const filename = objectName + '.txt';
          const mimetype = 'text/plain';
          const localFilePath = `/var/data/${bucket}/${filename}`;
          const dirname = path.dirname(localFilePath);
          fs.mkdirSync(dirname, { recursive: true });
          const content = await getPage(link);
          fs.writeFileSync(localFilePath, content);
          const size = new Blob([content]).size;
          resolve({
            id: uuid.v4(),
            dataSourceId,
            dataSourceName,
            uploadId,
            filename,
            objectName: filename,
            size,
            content,

            // required by the 'unstructured' extractor which reads files 
            // from the local file system
            filepath: localFilePath,
            originalname: filename,
            mimetype,
          });
        })
        proms.push(prom);
      } catch (err) {
        let message = err.message;
        if (err.stack) {
          message += '\n' + err.stack;
        }
        logger.error(message);
        // continue
      }
    }
    return Promise.all(proms);
  }

  return {
    __name,
    load,
  };
}

export default GoogleSearchLoader;
