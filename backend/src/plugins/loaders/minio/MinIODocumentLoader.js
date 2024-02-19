import Minio from 'minio';
import fs from 'fs';
import mime from 'mime-types';
import path from 'path';
import uuid from 'uuid';
import { Blob } from 'buffer';

function MinIODocumentLoader({ __name, constants, logger }) {

  const mc = new Minio.Client({
    endPoint: constants.S3_ENDPOINT,
    port: parseInt(constants.S3_PORT, 10),
    useSSL: constants.ENV !== 'dev',
    accessKey: constants.AWS_ACCESS_KEY,
    secretKey: constants.AWS_SECRET_KEY,
  });

  function getListing(bucket, path, recursive) {
    return new Promise((resolve, reject) => {
      const stream = mc.listObjectsV2(bucket, path, recursive);
      const objects = [];
      stream.on('data', function (obj) {
        logger.debug('obj:', obj);
        if (obj.name) {
          objects.push(obj);
        }
      });
      stream.on('end', function () {
        resolve(objects);
      });
      stream.on('error', function (err) {
        reject(err);
      });
    });
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
      objectNames = objects.map(obj => ({ objectName: obj.name }));
    }
    const _bucket = bucket || constants.FILE_BUCKET;
    for (const { objectName, uploadId } of objectNames) {
      const prom = new Promise((resolve, reject) => {
        const localFilePath = `/var/data/${_bucket}/${objectName}`;
        const dirname = path.dirname(localFilePath);
        fs.mkdirSync(dirname, { recursive: true });
        const fileStream = fs.createWriteStream(localFilePath);
        mc.getPartialObject(_bucket, objectName, 0, maxBytes, (err, dataStream) => {
          if (err) {
            logger.error(err);
            reject(err);
          }
          dataStream.on('data', (chunk) => {
            fileStream.write(chunk);
          });
          dataStream.on('end', () => {
            const filename = path.parse(objectName).base;
            const content = fs.readFileSync(localFilePath, { encoding: 'utf-8' });
            const size = new Blob([content]).size;
            const mimetype = mime.lookup(filename);
            resolve({
              id: uuid.v4(),
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
        });
      });
      proms.push(prom);
    }
    return Promise.all(proms);
  }

  return {
    __name,
    load,
  };
}

export default MinIODocumentLoader;
