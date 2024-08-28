import fs from 'fs';
import path from 'path';
import uuid from 'uuid';
import { ConfluenceClient } from 'confluence.js';

function ConfluenceLoader({ __name, constants, logger }) {

  let _client;

  function getClient() {
    if (!_client) {
      _client = new ConfluenceClient({
        host: `https://${constants.ATLASSIAN_DOMAIN}.atlassian.net`,
        authentication: {
          basic: {
            email: constants.ATLASSIAN_USERNAME,
            apiToken: constants.ATLASSIAN_API_TOKEN,
          },
        },
      });
    }
    return _client;
  }

  /**
   * 
   * @param {*} spaceKey
   * @returns 
   */
  async function getListing(spaceKey) {
    try {
      const client = await getClient();
      const res = await client.content.getContent({
        spaceKey,
      });
      return res.results;
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      logger.error(message);
      return [];
    }
  }

  async function load({
    dataSourceId,
    dataSourceName,
    objectNames,
    bucket,
    prefix,
    recursive,
    spaceKey,
    maxBytes = 0,
  }) {
    const proms = [];
    if (!objectNames) {
      let objects = await getListing(spaceKey);
      objectNames = objects
        .map(obj => ({
          id: obj.id,
        }));
    }
    bucket = bucket || constants.FILE_BUCKET;
    for (let { id, uploadId } of objectNames) {
      try {
        const prom = new Promise(async (resolve, reject) => {
          const filename = id + '.html';
          const localFilePath = constants.FILESTORE_PREFIX + `/var/data/${bucket}/${filename}`;
          const dirname = path.dirname(localFilePath);
          fs.mkdirSync(dirname, { recursive: true });
          const client = await getClient();
          const res = await client.content.getContentById({
            id,
            expand: 'body.storage',
          });
          const content = res.body.storage.value;
          const mimetype = 'text/html';
          fs.writeFileSync(localFilePath, content);
          const size = new Blob([content]).size;
          resolve({
            id: id || uuid.v4(),
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

export default ConfluenceLoader;
