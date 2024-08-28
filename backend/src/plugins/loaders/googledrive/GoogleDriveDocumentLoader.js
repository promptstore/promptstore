import fsmod from 'fs';
import mime from 'mime-types';
import path from 'path';
import process from 'process';
import uuid from 'uuid';
import { Blob } from 'buffer';
import { authenticate } from '@google-cloud/local-auth';
import { google } from 'googleapis';

const fs = fsmod.promises;

function GoogleDriveDocumentLoader({ __name, constants, logger }) {

  const SCOPES = [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/drive.metadata.readonly'
  ];
  // The file token.json stores the user's access and refresh tokens, and is
  // created automatically when the authorization flow completes for the first
  // time.
  const TOKEN_PATH = path.join(process.cwd(), 'src/plugins/loaders/googledrive/keys/token.json');
  const CREDENTIALS_PATH = path.join(process.cwd(), 'src/plugins/loaders/googledrive/keys/credentials.json');

  /**
   * Reads previously authorized credentials from the save file.
   *
   * @return {Promise<OAuth2Client|null>}
   */
  async function loadSavedCredentialsIfExist() {
    try {
      const content = await fs.readFile(TOKEN_PATH);
      const credentials = JSON.parse(content);
      return google.auth.fromJSON(credentials);
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      logger.error(message);
      return null;
    }
  }

  /**
   * Serializes credentials to a file compatible with GoogleAuth.fromJSON.
   *
   * @param {OAuth2Client} client
   * @return {Promise<void>}
   */
  async function saveCredentials(client) {
    const content = await fs.readFile(CREDENTIALS_PATH);
    const keys = JSON.parse(content);
    const key = keys.installed || keys.web;
    const payload = JSON.stringify({
      type: 'authorized_user',
      client_id: key.client_id,
      client_secret: key.client_secret,
      refresh_token: client.credentials.refresh_token,
    });
    await fs.writeFile(TOKEN_PATH, payload);
  }

  /**
   * Load or request or authorization to call APIs.
   *
   */
  async function authorize() {
    let client = await loadSavedCredentialsIfExist();
    if (client) {
      return client;
    }
    client = await authenticate({
      scopes: SCOPES,
      keyfilePath: CREDENTIALS_PATH,
    });
    if (client.credentials) {
      await saveCredentials(client);
    }
    return client;
  }

  let _drive;

  function getClient() {
    return new Promise((resolve, reject) => {
      if (_drive) {
        resolve(_drive);
      } else {
        authorize()
          .then(auth => {
            _drive = google.drive({ auth, version: 'v3' });
            resolve(_drive);
          })
          .catch(reject);
      }
    });
  }

  /**
   * 
   * @param {*} q query
   * @returns 
   */
  async function getListing(q) {
    try {
      const drive = await getClient();
      const res = await drive.files.list({
        fields: 'files(id, name, size)',
        q,
      });
      return res.data.files;
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
    maxBytes = 0,
  }) {
    const proms = [];
    if (!objectNames) {
      const [folderName] = prefix.split('/').filter(v => v).slice(-1);
      let q = `name = '${folderName}'`;
      let objects = await getListing(q);
      const folderId = objects[0].id;
      q = `mimeType != 'application/vnd.google-apps.folder' and '${folderId}' in parents`;
      objects = await getListing(q);
      objectNames = objects
        .filter(obj => !obj.name.endsWith('/'))
        .map(obj => ({
          id: obj.id,
          objectName: obj.name,
          size: obj.size,
        }));
    }
    bucket = bucket || constants.FILE_BUCKET;
    for (let { id, objectName, size, uploadId } of objectNames) {
      try {
        const prom = new Promise(async (resolve, reject) => {
          const localFilePath = constants.FILESTORE_PREFIX + `/var/data/${bucket}/${objectName}`;
          const dirname = path.dirname(localFilePath);
          fsmod.mkdirSync(dirname, { recursive: true });
          const fileStream = fsmod.createWriteStream(localFilePath);
          const drive = await getClient();
          const options = { fileId: id, alt: 'media' };
          if (maxBytes && maxBytes > 0) {
            options.headers = { Range: `bytes=0-${maxBytes}` };
          }
          drive.files.get(options, { responseType: 'stream' }, (err, res) => {
            if (err) {
              reject(err);
            }
            res.data
              .on('end', () => {
                const filename = path.parse(objectName).base;
                const content = fsmod.readFileSync(localFilePath, { encoding: 'utf-8' });
                if (!size) {
                  size = new Blob([content]).size;
                }
                const mimetype = mime.lookup(filename);
                resolve({
                  id: id || uuid.v4(),
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
              })
              .on('error', reject)
              .pipe(fileStream);
          })
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

export default GoogleDriveDocumentLoader;
