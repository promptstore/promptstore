import axios from 'axios';
import { Storage } from '@google-cloud/storage';
import { VertexAI } from '@google-cloud/vertexai';
import aiplatform from '@google-cloud/aiplatform';
import uuid from 'uuid';

import { MessageRole } from '../../../core/conversions';
import {
  fromGeminiChatResponse,
  toGeminiChatRequest,
} from './conversions';

const { PredictionServiceClient } = aiplatform.v1;
const { helpers } = aiplatform;

function GeminiLLM({ __name, constants, logger }) {

  let _chatClient;
  let _storage;
  let _predictionServiceClient;

  const clientOptions = {
    apiEndpoint: `${constants.GOOGLE_PROJECT_LOCATION}-aiplatform.googleapis.com`,
  };

  const endpoint = `projects/${constants.GOOGLE_PROJECT_ID}/locations/${constants.GOOGLE_PROJECT_LOCATION}/publishers/google/models/imagen-3.0-generate-001`;

  function getPredictionServiceClient() {
    if (!_predictionServiceClient) {
      _predictionServiceClient = new PredictionServiceClient(clientOptions);
    }
    return _predictionServiceClient;
  }

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

  async function sendRestRequest(request) {
    const res = await axios.post(`${constants.GOOGLE_LEARNLM_URL}?key=${constants.GOOGLE_GEMINI_API_KEY}`, request);
    return res.data;
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
    logger.debug(model, 'request:', req);
    let response;
    // LearnLM not currently supported by VertexAI client
    if (model === 'learnlm-1.5-pro-experimental') {
      const res = await sendRestRequest(req);
      response = await fromGeminiChatResponse(res, parser);
    } else {
      const stream = await genModel.generateContent(req);
      const res = await stream;
      response = await fromGeminiChatResponse(res.response, parser);
    }
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

  async function createImage(prompt, options) {
    logger.debug('prompt:', prompt);
    const promptText = {
      prompt: prompt.prompt.messages[0].content,
    };
    const instanceValue = helpers.toValue(promptText);
    const instances = [instanceValue];

    const parameter = {
      sampleCount: 1,
      // You can't use a seed value and watermark at the same time.
      // seed: 100,
      // addWatermark: false,
      aspectRatio: '1:1',
      safetyFilterLevel: 'block_some',
      personGeneration: 'allow_adult',
    };
    const parameters = helpers.toValue(parameter);

    const request = {
      endpoint,
      instances,
      parameters,
    };

    logger.debug('request:', request);

    const content = [];

    // Predict request
    const predictionServiceClient = getPredictionServiceClient();
    const [response] = await predictionServiceClient.predict(request);
    logger.debug('response:', response);
    const predictions = response.predictions;
    if (predictions.length === 0) {
      console.log(
        'No image was generated. Check the request parameters and prompt.'
      );
    } else {
      for (const prediction of predictions) {
        const buff = Buffer.from(
          prediction.structValue.fields.bytesBase64Encoded.stringValue,
          'base64'
        );
        content.push({
          type: 'base64',
          base64: buff,
        });
      }
    }
    const choices = [
      {
        index: 0,
        message: {
          role: MessageRole.assistant,
          content,
        },
      }
    ];
    return {
      id: uuid.v4(),
      created: new Date(),
      n: choices.length,
      choices,
    };
  }

  async function generateImageVariant(imageUrl, options) {
    const res = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const encodedImage = Buffer.from(res.data, 'binary').toString('base64');
    const promptObj = {
      // prompt: prompt.prompt.messages[0].content,
      prompt: 'Change the player to photorealistic image of a female player.',
      image: { bytesBase64Encoded: encodedImage },
    };
    const instanceValue = helpers.toValue(promptObj);
    const instances = [instanceValue];

    const parameter = {
      sampleCount: 1,
      // You can't use a seed value and watermark at the same time.
      seed: 100,
      // addWatermark: false,
      // Controls the strength of the prompt
      // 0-9 (low strength), 10-20 (medium strength), 21+ (high strength)
      guidanceScale: 21,
      // aspectRatio: '1:1',
      // safetyFilterLevel: 'block_some',
      // personGeneration: 'allow_adult',
    };
    const parameters = helpers.toValue(parameter);

    const request = {
      endpoint,
      instances,
      parameters,
    };

    logger.debug('request:', request);

    const content = [];

    // Predict request
    const predictionServiceClient = getPredictionServiceClient();
    const [response] = await predictionServiceClient.predict(request);
    logger.debug('response:', response);
    const predictions = response.predictions;
    if (predictions.length === 0) {
      console.log(
        'No image was generated. Check the request parameters and prompt.'
      );
    } else {
      for (const prediction of predictions) {
        const buff = Buffer.from(
          prediction.structValue.fields.bytesBase64Encoded.stringValue,
          'base64'
        );
        content.push({
          type: 'base64',
          base64: buff,
        });
      }
    }
    const choices = [
      {
        index: 0,
        message: {
          role: MessageRole.assistant,
          content,
        },
      }
    ];
    return {
      id: uuid.v4(),
      created: new Date(),
      n: choices.length,
      choices,
    };
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
