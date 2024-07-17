import { Blob } from 'buffer';
import fs from 'fs';
import mime from 'mime-types';
import Minio from 'minio';
import path from 'path';
import uuid from 'uuid';

function MinIODocumentLoader({ __name, constants, logger }) {

  let _mc;

  function getClient() {
    if (!_mc) {
      _mc = new Minio.Client({
        endPoint: constants.S3_ENDPOINT,
        port: parseInt(constants.S3_PORT, 10),
        useSSL: constants.ENV !== 'dev',
        accessKey: constants.AWS_ACCESS_KEY,
        secretKey: constants.AWS_SECRET_KEY,
      });
    }
    return _mc;
  }

  function getListing(bucket, path, recursive) {
    return new Promise((resolve, reject) => {
      const stream = getClient().listObjectsV2(bucket, path, recursive);
      const objects = [];
      stream.on('data', function (obj) {
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
      objectNames = objects
        .filter(obj => !obj.name.endsWith('/'))
        .map(obj => ({ objectName: obj.name }));
    }
    bucket = bucket || constants.FILE_BUCKET;
    for (const { objectName, uploadId } of objectNames) {
      const prom = new Promise((resolve, reject) => {
        const localFilePath = `/var/data/${bucket}/${objectName}`;
        const dirname = path.dirname(localFilePath);
        fs.mkdirSync(dirname, { recursive: true });
        const fileStream = fs.createWriteStream(localFilePath);
        getClient().getPartialObject(bucket, objectName, 0, maxBytes, (err, dataStream) => {
          if (err) {
            let message;
            if (err instanceof Error) {
              message = err.message;
              if (err.stack) {
                message += '\n' + err.stack;
              }
            } else {
              message = err.toString();
            }
            logger.error(message);
            return reject(err);
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
