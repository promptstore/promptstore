import { Blob } from 'buffer';
import fs from 'fs';
import mime from 'mime-types';
import path from 'path';

export function DocumentsService({ constants, mc, logger }) {

  function download(filepath) {
    const bucket = constants.FILE_BUCKET;
    logger.debug('Downloading %s from bucket %s', filepath, bucket);
    return new Promise((resolve, reject) => {
      const localFilePath = `/var/data/${constants.FILE_BUCKET}/${filepath}`;
      const dirname = path.dirname(localFilePath);
      fs.mkdirSync(dirname, { recursive: true });
      mc.statObject(bucket, filepath, (err, stat) => {
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
        if (!stat) {
          err = new Error(
            'Failed to get metadata of ' + filepath +
            ' in bucket ' + bucket
          );
          logger.error(err.message);
          return reject(err);
        }
        mc.fGetObject(constants.FILE_BUCKET, filepath, localFilePath, (err) => {
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
            reject(err);
          }
          // return fake upload file
          const mimetype = stat.metaData?.['Content-Type'] || mime.lookup(path.extname(filepath));
          const filename = stat.metaData?.filename || path.parse(filepath).base;
          const file = new Blob([''], { type: mimetype });
          file.originalname = filename;
          file.mimetype = mimetype;
          file.path = localFilePath;
          file.lastModified = stat.lastModified;
          file.etag = stat.etag;
          resolve(file);
        });
      });
    });
  }

  function read(filepath, maxBytes = 0) {
    return new Promise((resolve, reject) => {
      const localFilePath = `/var/data/${constants.FILE_BUCKET}/${filepath}`;
      const dirname = path.dirname(localFilePath);
      fs.mkdirSync(dirname, { recursive: true });
      const fileStream = fs.createWriteStream(localFilePath);
      mc.getPartialObject(constants.FILE_BUCKET, filepath, 0, maxBytes, (err, dataStream) => {
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
          reject(err);
        }
        dataStream.on('data', (chunk) => {
          fileStream.write(chunk);
        });
        dataStream.on('end', () => {
          const contents = fs.readFileSync(localFilePath, { encoding: 'utf-8' });
          resolve(contents);
        });
      });
    });
  }

  return {
    download,
    read,
  };

}
