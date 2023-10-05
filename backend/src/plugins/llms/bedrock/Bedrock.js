import { delay } from './utils';

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

function Bedrock({ __name, constants, logger }) {

  let client;

  function getClient() {
    if (!client) {
      client = new BedrockRuntimeClient({
        region: constants.AWS_REGION,
        credentials: {
          accessKeyId: constants.AWS_ACCESS_KEY_ID,
          secretAccessKey: constants.AWS_SECRET_ACCESS_KEY,
          sessionToken: constants.AWS_SESSION_TOKEN,
        }
      });
    }
    return client;
  }

  async function createChatCompletion(request, retryCount = 0) {
    const { modelId, body } = request;
    try {
      const client = getClient();
      const res = await client.send(new InvokeModelCommand({
        modelId,
        contentType: 'application/json',
        accept: '*/*',
        body: Buffer.from(JSON.stringify(body)),
      }));
      const response = JSON.parse(Buffer.from(res.body));
      return response;
    } catch (err) {
      logger.error(err, err.stack);
      if (retryCount > 1) {
        throw new Error('Exceeded retry count: ' + String(err), { cause: err });
      }
      await delay(2000);
      client = null;  // try refreshing the client if `ERR_SOCKET_CONNECTION_TIMEOUT`
      return await createChatCompletion(request, retryCount + 1);
    }
  }

  async function createCompletion(request) {
    const res = await createChatCompletion(request);
    return res;
  }

  function createImage(prompt, n) {
    throw new Error('Not implemented');
  }

  function generateImageVariant(imageUrl, n) {
    throw new Error('Not implemented');
  }

  return {
    __name,
    createChatCompletion,
    createCompletion,
    createImage,
    generateImageVariant,
  };

}

export default Bedrock;
