import fs from 'fs';
import path from 'path';
import uuid from 'uuid';

import {
  PARA_DELIM,
  ChatRequest,
  Message,
  MessageRole,
  createOpenAIMessages,
} from '../../../core/conversions';
import {
  StabilityAIBedrockImageResponse,
} from './stabilityai_types';

export function toStabilityAIImageRequest(request: ChatRequest) {
  const {
    model,
    model_params,
  } = request;
  const {
    aspect_ratio,
    negative_prompt,
    seed,
    output_format,
  } = model_params;
  let messages: Message[] = createOpenAIMessages(request.prompt);
  const prompt = messages.map(m => m.content).join(PARA_DELIM);
  return {
    modelId: model,
    body: {
      prompt,
      aspect_ratio,
      negative_prompt,
      seed,
      output_format,
    },
  };
}

export function toStabilityAIBedrockImageRequest(request: ChatRequest) {
  const {
    model,
    model_params,
  } = request;
  const {
    negative_prompt,
    seed,
    size,
    style_preset,
    cfg_scale,
    clip_guidance_preset,
    sampler,
    steps,
    extras,
  } = model_params;
  let messages: Message[] = createOpenAIMessages(request.prompt);
  const prompt = messages.map(m => m.content).join(PARA_DELIM);
  const text_prompts = [{ text: prompt, weight: 1 }];
  if (negative_prompt) {
    text_prompts.push({ text: negative_prompt, weight: -1 });
  }
  const [width, height] = (size || '1024x1024').split('x');
  return {
    modelId: model,
    body: {
      text_prompts: [{ text: prompt }],
      height: parseInt(height, 10),
      width: parseInt(width, 10),
      seed,
      style_preset,
      cfg_scale,
      clip_guidance_preset,
      sampler,
      steps,
      extras,
    },
  };
}

const saveFile = (base64: string, finishedReason: string, index: number, mc: any, constants: any, logger: any) => {
  return new Promise((resolve, reject) => {
    const filename = uuid.v4() + '.png';
    const localFilePath = constants.FILESTORE_PREFIX + '/var/data/images/' + filename;
    const objectName = path.join(String(constants.WORKSPACE_ID), constants.IMAGES_PREFIX, filename);
    logger.debug('bucket:', constants.FILE_BUCKET);
    logger.debug('objectName:', objectName);
    const metadata = {
      'Content-Type': 'image/png',
    };
    fs.writeFile(localFilePath, base64, { encoding: 'base64' }, (err: Error) => {
      if (err) {
        return reject(err);
      }
      mc.fPutObject(constants.FILE_BUCKET, objectName, localFilePath, metadata, (err: Error) => {
        if (err) {
          return reject(err);
        }
        logger.info('File uploaded successfully.');
        mc.presignedUrl('GET', constants.FILE_BUCKET, objectName, (err: Error, presignedUrl: string) => {
          if (err) {
            return reject(err);
          }
          logger.debug('presigned url:', presignedUrl);
          const u = new URL(presignedUrl);
          const imageUrl = constants.BASE_URL + '/api/dev/images' + u.pathname + u.search;
          resolve({
            finish_reason: finishedReason,
            index,
            message: {
              role: MessageRole.assistant,
              content: [
                {
                  type: 'image_url',
                  image_url: { url: imageUrl },
                  objectName,
                },
              ],
            },
          });
        });
      });
    });
  })
};

export async function fromStabilityAIBedrockImageResponse(response: StabilityAIBedrockImageResponse, mc: any, constants: any, logger: any) {
  const proms = response.artifacts.map(({ base64, finishedReason }, index) => {
    return saveFile(base64, finishedReason, index, mc, constants, logger);
  });
  const choices = await Promise.all(proms);
  return {
    id: uuid.v4(),
    created: new Date(),
    n: choices.length,
    choices,
  };
}
