import axios from 'axios';
import { Storage } from '@google-cloud/storage';
import { VertexAI } from '@google-cloud/vertexai';

import {
  fromGeminiChatResponse,
  toGeminiChatRequest,
} from './conversions';

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
   * 
   * @param {*} request 
   * @param {*} parser 
   * @param {*} retryCount 
   * @returns 
   */
  async function createChatCompletion(request, parser, retryCount = 0) {
    const model = request.model;
    const chatRequest = toGeminiChatRequest(request);
    const storage = getStorageClient();
    const bucket = storage.bucket(constants.GCS_BUCKET);
    let contents = [];
    for (const c of chatRequest.contents) {
      let parts = [];
      for (const part of c.parts) {
        if (part.file_data) {
          const imageUrl = part.file_data.file_uri;
          const url = new URL(imageUrl);
          const pathname = url.pathname.slice(constants.GCS_BUCKET.length + 2);
          const file = bucket.file(pathname);
          const [exists] = await file.exists();
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
    const genModel = client.preview.getGenerativeModel({ model });

    // "Function as tool is only supported for `gemini-pro` and `gemini-pro-001` models."
    let tools;
    if (model !== 'gemini-1.0-pro-vision') {
      tools = chatRequest.tools;
    }
    const req = {
      contents,
      generationConfig: chatRequest.generationConfig,
      safetySettings: chatRequest.safetySettings,
      tools,
    };
    // logger.debug(model, 'request:', req);
    const stream = await genModel.generateContent(req);
    const res = await stream;
    const response = await fromGeminiChatResponse(res.response, parser);
    return { ...response, model };
  }

  /**
   * @param {*} request 
   * @returns 
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

  function getNumberTokens(model, text) {
    throw new Error('Not implemented');
  }

  return {
    __name,
    createChatCompletion,
    createCompletion,
    createEmbedding,
    createImage,
    generateImageVariant,
    getNumberTokens,
  };

}

export default GeminiLLM;
