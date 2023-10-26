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
    useSSL: false,
    accessKey: constants.AWS_ACCESS_KEY,
    secretKey: constants.AWS_SECRET_KEY,
  });

  function download(filepath) {
    return new Promise((resolve, reject) => {
      const localFilePath = `/var/data/${constants.FILE_BUCKET}/${filepath}`;
      const dirname = path.dirname(localFilePath);
      fs.mkdirSync(dirname, { recursive: true });
      mc.statObject(constants.FILE_BUCKET, filepath, (err, stat) => {
        if (err) {
          logger.error(err);
          reject(err);
        }
        mc.fGetObject(constants.FILE_BUCKET, filepath, localFilePath, (err) => {
          if (err) {
            logger.error(err);
            reject(err);
          }
          // return fake upload file
          const mimetype = stat.metaData?.['Content-Type'] || mime.lookup(path.extname(filepath));
          const filename = stat.metaData?.filename || path.parse(filepath).base;
          const file = new Blob([''], { type: mimetype });
          file.originalname = filename;
          file.mimetype = mimetype;
          file.path = localFilePath;
          // file.size = stat.size;
          file.lastModified = stat.lastModified;
          file.etag = stat.etag;
          resolve(file);
        });
      });
    });
  }

  function load({ objectName, maxBytes = 0 }) {
    return new Promise((resolve, reject) => {
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
          resolve([
            {
              id: uuid.v4(),
              filename,
              objectName,
              size,
              content,
            }
          ]);
        });
      });
    });
  }

  return {
    __name,
    download,
    load,
  };
}

export default MinIODocumentLoader;
