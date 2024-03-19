import { GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { Blob } from 'buffer';
import fs from 'fs';
import mime from 'mime-types';
import path from 'path';
import trim from 'lodash.trim';
import uuid from 'uuid';

function S3DocumentLoader({ __name, constants, logger }) {

  let _client;

  function getClient() {
    if (!_client) {
      _client = new S3Client({
        region: constants.S3_REGION,
        credentials: {
          accessKeyId: constants.S3_ACCESS_KEY_ID,
          secretAccessKey: constants.S3_SECRET_ACCESS_KEY,
        },
      });
    }
    return _client;
  }

  /**
   * 
   * @param {*} bucket 
   * @param {*} prefix 
   * @param {*} recursive 
   * @param {*} delimiter 
   * @returns 
   */
  async function getListing(bucket, prefix, recursive) {
    const options = {
      Bucket: bucket,
      Prefix: prefix,
    };
    if (!recursive) {
      options.Delimiter = '/';
    }
    const command = new ListObjectsV2Command(options);
    const response = await getClient().send(command);
    return response.Contents;
  }

  async function load({
    dataSourceId,
    dataSourceName,
    objectNames,
    bucket,
    prefix,
    recursive,
    maxBytes = 0,
  }) {
    const proms = [];
    if (!objectNames) {
      const objects = await getListing(bucket, prefix, recursive);
      logger.debug('objects:', objects);
      objectNames = objects
        .filter(obj => !obj.Key.endsWith('/'))
        .map(obj => ({
          objectName: obj.Key,
          size: obj.Size,
          etag: trim(obj.ETag, '"'),
        }));
    }
    logger.debug('objectNames:', objectNames);
    bucket = bucket || constants.FILE_BUCKET;
    for (let { etag, objectName, size, uploadId } of objectNames) {
      try {
        const prom = new Promise(async (resolve, reject) => {
          const localFilePath = `/var/data/${bucket}/${objectName}`;
          const dirname = path.dirname(localFilePath);
          fs.mkdirSync(dirname, { recursive: true });
          const options = {
            Bucket: bucket,
            Key: objectName,
          };
          const command = new GetObjectCommand(options);
          const response = await getClient().send(command);
          const bodyAsString = await response.Body.transformToString();
          const fileStream = fs.createWriteStream(localFilePath);
          await fileStream.write(bodyAsString);
          const content = fs.readFileSync(localFilePath, { encoding: 'utf-8' });
          if (!size) {
            size = new Blob([content]).size;
          }
          const filename = path.parse(objectName).base;
          const mimetype = mime.lookup(filename);
          resolve({
            id: etag || uuid.v4(),
            dataSourceId,
            dataSourceName,
            uploadId,
            filename,
            objectName,
            size,
            content,

            // required by the 'unstructured' extractor which reads files 
            // from the local file system
            filepath: localFilePath,
            originalname: filename,
            mimetype,
          });
        });
        proms.push(prom);
      } catch (err) {
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

export default S3DocumentLoader;
