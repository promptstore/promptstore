import Minio from 'minio';
import fs from 'fs';
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

  function load({ objectNames, maxBytes = 0 }) {
    const proms = [];
    for (const objectName of objectNames) {
      const prom = new Promise((resolve, reject) => {
        const localFilePath = `/var/data/${constants.FILE_BUCKET}/${objectName}`;
        const dirname = path.dirname(localFilePath);
        fs.mkdirSync(dirname, { recursive: true });
        const fileStream = fs.createWriteStream(localFilePath);
        mc.getPartialObject(constants.FILE_BUCKET, objectName, 0, maxBytes, (err, dataStream) => {
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
            resolve({
              id: uuid.v4(),
              filename,
              objectName,
              size,
              content,
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
