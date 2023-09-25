import fs from 'fs';
import mime from 'mime-types';
import path from 'path';
import { Blob } from 'buffer';
import { parse } from 'csv-parse/sync';

export function DocumentsService({ constants, mc, logger }) {

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

  function read(filepath, maxBytes = 0, transformation, options) {
    return new Promise((resolve, reject) => {
      const localFilePath = `/var/data/${constants.FILE_BUCKET}/${filepath}`;
      const dirname = path.dirname(localFilePath);
      fs.mkdirSync(dirname, { recursive: true });
      const fileStream = fs.createWriteStream(localFilePath);
      mc.getPartialObject(constants.FILE_BUCKET, filepath, 0, maxBytes, (err, dataStream) => {
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
    download,
    read,
    transformations,
  };

}
