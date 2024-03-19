import fsmod from 'fs';
import path from 'path';
import process from 'process';
import uuid from 'uuid';
import { authenticate } from '@google-cloud/local-auth';
import { google } from 'googleapis';

const fs = fsmod.promises;

function GmailDocumentLoader({ __name, constants, logger }) {

  const SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
  ];
  // The file token.json stores the user's access and refresh tokens, and is
  // created automatically when the authorization flow completes for the first
  // time.
  const TOKEN_PATH = path.join(process.cwd(), 'src/plugins/loaders/gmail/keys/token.json');
  const CREDENTIALS_PATH = path.join(process.cwd(), 'src/plugins/loaders/gmail/keys/credentials.json');

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

  let _gmail;

  function getClient() {
    return new Promise((resolve, reject) => {
      if (_gmail) {
        resolve(_gmail);
      } else {
        authorize()
          .then(auth => {
            _gmail = google.gmail({ auth, version: 'v1' });
            resolve(_gmail);
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
      const gmail = await getClient();
      const res = await gmail.users.messages.list({
        q,
        includeSpamTrash: false,
        userId: 'me',
      });
      return res.data.messages;
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
    query,
    maxBytes = 0,
  }) {
    const proms = [];
    if (!objectNames) {
      let objects = await getListing(query);
      logger.debug('objects:', objects);
      objectNames = objects
        .map(obj => ({
          id: obj.id,
        }));
    }
    logger.debug('objectNames:', objectNames);
    bucket = bucket || constants.FILE_BUCKET;
    for (let { id, uploadId } of objectNames) {
      try {
        const prom = new Promise(async (resolve, reject) => {
          const filename = id + '.txt';
          const localFilePath = `/var/data/${bucket}/${filename}`;
          const dirname = path.dirname(localFilePath);
          fsmod.mkdirSync(dirname, { recursive: true });
          const gmail = await getClient();
          const options = { id, userId: 'me' };
          if (maxBytes && maxBytes > 0) {
            options.headers = { Range: `bytes=0-${maxBytes}` };
          }
          const message = await gmail.users.messages.get(options);
          logger.debug('message:', message);
          const parts = message.data.payload.parts;
          const mimetype = 'text/plain';
          const textPart = parts.find(p => p.mimeType === mimetype);
          const { data, size } = textPart.body;
          const content = Buffer.from(data, 'base64').toString('utf-8');
          logger.debug('content:', content);
          fsmod.writeFileSync(localFilePath, content);
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

export default GmailDocumentLoader;
