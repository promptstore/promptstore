import fs from 'fs';
import path from 'path';
import uuid from 'uuid';

import {
  PARA_DELIM,
  ChatRequest,
  MessageRole,
  Message,
  createOpenAIMessages
} from '../../../core/conversions';

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
    style_preset,
  } = model_params;
  let messages: Message[] = createOpenAIMessages(request.prompt);
  const prompt = messages.map(m => m.content).join(PARA_DELIM);
  return {
    prompt,
    aspect_ratio,
    negative_prompt,
    seed,
    output_format,
    style_preset,
  };
}

const saveFile = (base64: Buffer, index: number, mc: any, constants: any, logger: any) => {
  return new Promise((resolve, reject) => {
    const filename = uuid.v4() + '.png';
    const localFilePath = constants.FILESTORE_PREFIX + '/var/data/images/' + filename;
    const objectName = path.join(String(constants.WORKSPACE_ID), constants.IMAGES_PREFIX, filename);
    logger.debug('bucket:', constants.FILE_BUCKET);
    logger.debug('objectName:', objectName);
    const metadata = {
      'Content-Type': 'image/png',
    };
    fs.writeFile(localFilePath, base64, (err: Error) => {
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
            finish_reason: 'SUCCESS',
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

export async function fromStabilityAIImageResponse(response: any, mc: any, constants: any, logger: any) {
  const choice = await saveFile(Buffer.from(response), 0, mc, constants, logger);
  return {
    id: uuid.v4(),
    created: new Date(),
    n: 1,
    choices: [choice],
  };
}
