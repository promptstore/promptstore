import Minio from 'minio';
import { countTokens } from '@anthropic-ai/tokenizer';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

import { delay } from '../../../core/conversions';

import {
  fromAI21ChatResponse,
  toAI21ChatRequest,
} from './ai21_conversions';
import {
  fromAnthropicChatResponse,
  toAnthropicChatRequest,
} from './anthropic_conversions';
import {
  fromCohereLegacyChatResponse,
  toCohereLegacyChatRequest,
} from './cohere_conversions';
import {
  fromStabilityAIBedrockImageResponse,
  toStabilityAIBedrockImageRequest,
} from './stabilityai_conversions';

function Bedrock({ __name, constants, logger }) {

  const mc = new Minio.Client({
    endPoint: constants.S3_ENDPOINT,
    port: parseInt(constants.S3_PORT, 10),
    useSSL: constants.ENV !== 'dev',
    accessKey: constants.AWS_ACCESS_KEY,
    secretKey: constants.AWS_SECRET_KEY,
  });

  let _client;

  function getClient() {
    if (!_client) {
      _client = new BedrockRuntimeClient({
        region: constants.AWS_REGION,
        credentials: {
          accessKeyId: constants.AWS_ACCESS_KEY_ID,
          secretAccessKey: constants.AWS_SECRET_ACCESS_KEY,
          sessionToken: constants.AWS_SESSION_TOKEN,
        }
      });
    }
    return _client;
  }

  async function createChatCompletion(request, parserService, retryCount = 0) {
    try {
      const model = request.model;
      let req;
      if (model.startsWith('ai21')) {
        req = toAI21ChatRequest(request);
      } else if (model.startsWith('anthropic')) {
        req = toAnthropicChatRequest(request);
      } else if (model.startsWith('cohere')) {
        req = toCohereLegacyChatRequest(request);
      } else {
        throw new Error('Unknown model ' + model);
      }
      const { modelId, body } = req;
      const client = getClient();
      const res = await client.send(new InvokeModelCommand({
        modelId,
        contentType: 'application/json',
        accept: '*/*',
        body: Buffer.from(JSON.stringify(body)),
      }));
      const parsed = JSON.parse(Buffer.from(res.body));
      if (model.startsWith('ai21')) {
        const response = await fromAI21ChatResponse(parsed, parserService);
        return {
          ...response,
          model,
        };
      } else if (model.startsWith('anthropic')) {
        const response = await fromAnthropicChatResponse(parsed, parserService);
        const prompt_tokens = this.getNumberTokens(model, req.body.prompt);
        const completion_tokens = this.getNumberTokens(model, parsed.completion);
        const total_tokens = prompt_tokens + completion_tokens;
        return {
          ...response,
          model,
          usage: { prompt_tokens, completion_tokens, total_tokens },
        };
      } else if (model.startsWith('cohere')) {
        const response = await fromCohereLegacyChatResponse(parsed, parserService);
        return {
          ...response,
          model,
        };
      }
      throw new Error('should not be able to get here');
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      logger.error(message);
      if (retryCount > 1) {
        throw new Error('Exceeded retry count: ' + err.message, { cause: err });
      }
      await delay(2000);
      _client = null;  // try refreshing the client if `ERR_SOCKET_CONNECTION_TIMEOUT`
      return createChatCompletion(request, retryCount + 1);
    }
  }

  function createCompletion(request) {
    return createChatCompletion(request);
  }

  async function createImage(request) {
    const req = toStabilityAIBedrockImageRequest(request);
    const { modelId, body } = req;
    const client = getClient();
    const res = await client.send(new InvokeModelCommand({
      modelId,
      contentType: 'application/json',
      accept: '*/*',
      body: Buffer.from(JSON.stringify(body)),
    }));
    const parsed = JSON.parse(Buffer.from(res.body));
    if (modelId.startsWith('stability')) {
      const response = await fromStabilityAIBedrockImageResponse(parsed, mc, constants, logger);
      return {
        ...response,
        model: modelId,
      };
    }
    throw new Error('Not implemented');
  }

  function generateImageVariant(imageUrl, options) {
    throw new Error('Not implemented');
  }

  function getNumberTokens(model, text) {
    if (text && model?.startsWith('anthropic')) {
      return countTokens(text);
    }
    return 0;
  }

  return {
    __name,
    createChatCompletion,
    createCompletion,
    createImage,
    generateImageVariant,
    getNumberTokens,
  };

}

export default Bedrock;
