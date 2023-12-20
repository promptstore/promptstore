import axios from 'axios';
import { Storage } from '@google-cloud/storage';
import { VertexAI } from '@google-cloud/vertexai';

function GeminiLLM({ __name, constants, logger }) {

  let _chatClient;
  let _storage;

  function getChatClient() {
    if (!_chatClient) {
      _chatClient = new VertexAI({
        project: constants.GOOGLE_PROJECT_ID,
        location: constants.GOOGLE_PROJECT_LOCATION
      });
    }
    return _chatClient;
  }

  function getStorageClient() {
    if (!_storage) {
      _storage = new Storage();
    }
    return _storage;
  }

  function uploadFile(imageUrl, file) {
    return new Promise(async (resolve, reject) => {
      const writeStream = file.createWriteStream();
      const res = await axios.get(imageUrl, { responseType: 'stream' });
      res.data.pipe(writeStream)
        .on('error', reject)
        .on('finish', resolve);
    });
  }

  /**
   * @param {GeminiChatRequest} request 
   * @param {integer} retryCount 
   * @returns 'GeminiChatResponse'
   */
  async function createChatCompletion(request, retryCount = 0) {
    const storage = getStorageClient();
    const bucket = storage.bucket(constants.GCS_BUCKET);
    let contents = [];
    for (const c of request.contents) {
      // logger.debug('content:', c);
      let parts = [];
      for (const part of c.parts) {
        // logger.debug('part:', part);
        if (part.file_data) {
          const imageUrl = part.file_data.file_uri;
          const url = new URL(imageUrl);
          const pathname = url.pathname.slice(constants.GCS_BUCKET.length + 2);
          const file = bucket.file(pathname);
          const [exists] = await file.exists();
          // logger.debug('file exists:', exists);
          if (!exists) {
            await uploadFile(imageUrl, file);
          }
          parts.push({
            file_data: {
              mime_type: part.file_data.mime_type,
              file_uri: `gs://${constants.GCS_BUCKET}/` + pathname,
            }
          })
        } else {
          parts.push(part);
        }
      }
      contents.push({
        role: c.role,
        parts,
      });
    }
    const client = getChatClient();
    const model = client.preview.getGenerativeModel({
      model: request.model,
    });
    const req = {
      contents,
      generation_config: request.generation_config,
    };
    logger.debug(request.model + ' request:', req);
    const stream = await model.generateContent(req);
    const res = await stream;
    return res.response;
  }

  /**
   * @param {GeminiChatRequest} request 
   * @returns 'GeminiChatResponse'
   */
  async function createCompletion(request) {
    return createChatCompletion(request);
  }

  async function createEmbedding(request) {
    throw new Error('Not implemented');
  }

  function createImage(prompt, options) {
    throw new Error('Not implemented');
  }

  function generateImageVariant(imageUrl, options) {
    throw new Error('Not implemented');
  }

  return {
    __name,
    createChatCompletion,
    createCompletion,
    createEmbedding,
    createImage,
    generateImageVariant,
  };

}

export default GeminiLLM;
