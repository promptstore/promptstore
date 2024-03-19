import { Storage } from '@google-cloud/storage';
import { Blob } from 'buffer';
import fs from 'fs';
import mime from 'mime-types';
import path from 'path';
import uuid from 'uuid';

function GCSDocumentLoader({ __name, constants, logger }) {

  let _storage;

  function getClient() {
    if (!_storage) {
      _storage = new Storage();
    }
    return _storage;
  }

  /**
   * The delimiter argument can be used to restrict the results to only the
   * "files" in the given "folder". Without the delimiter, the entire tree under
   * the prefix is returned. For example, given these blobs:
   *
   *   /a/1.txt
   *   /a/b/2.txt
   *
   * If you just specify prefix = 'a/', you'll get back:
   *
   *   /a/1.txt
   *   /a/b/2.txt
   *
   * However, if you specify prefix='a/' and delimiter='/', you'll get back:
   *
   *   /a/1.txt
   * 
   * @param {*} bucket 
   * @param {*} prefix 
   * @param {*} recursive 
   * @param {*} delimiter 
   * @returns 
   */
  async function getListing(bucket, prefix, recursive) {
    const options = { prefix };
    if (!recursive) {
      options.delimiter = '/';
    }
    const [files] = await getClient().bucket(bucket).getFiles(options);
    return files;
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
    bucket = bucket || constants.GCS_BUCKET;
    for (const { objectName, uploadId } of objectNames) {
      try {
        const prom = new Promise(async (resolve, reject) => {
          const localFilePath = `/var/data/${bucket}/${objectName}`;
          const dirname = path.dirname(localFilePath);
          fs.mkdirSync(dirname, { recursive: true });
          const options = { destination: localFilePath };
          await getClient().bucket(bucket).file(objectName).download(options);
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

export default GCSDocumentLoader;
