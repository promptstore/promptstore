const { Configuration, OpenAIApi } = require('openai');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const { delay } = require('./utils');

function OpenAILLM({ __name, constants, logger }) {

  const configuration = new Configuration({
    apiKey: constants.OPENAI_API_KEY,
  });

  const openai = new OpenAIApi(configuration);

  async function createChatCompletion(messages, model, maxTokens, n, functions, stop, retryCount = 0) {
    let res;
    try {
      const opts = {
        max_tokens: maxTokens,
        messages,
        model,
        n,
        functions,
        stop,
      };
      logger.debug('options:', JSON.stringify(opts, null, 2));
      res = await openai.createChatCompletion(opts);
      logger.debug('res:', JSON.stringify(res.data, null, 2));
      return res.data;
    } catch (err) {
      logger.error(String(err));
      if (res?.data.error?.message.startsWith('That model is currently overloaded with other requests')) {
        if (retryCount > 2) {
          throw new Error('Exceeded retry count: ' + String(err), { cause: err });
        }
        await delay(2000);
        return await createChatCompletion(messages, model, maxTokens, n, functions, stop, retryCount + 1);
      }
    }
  }

  async function createCompletion(prompt, model, maxTokens, n, stop) {
    const opts = {
      max_tokens: maxTokens,
      model,
      n,
      prompt,
      stop,
    };
    logger.debug('options:', JSON.stringify(opts, null, 2));
    const res = await openai.createCompletion(opts);
    return res.data;
  }

  const fetchChatCompletion = async (messages, model, maxTokens, n, functions, stop) => {
    const prompt = messages[messages.length - 1];
    const response = await createChatCompletion(messages, model, maxTokens, n, functions, stop);
    return {
      ...response,
      choices: response.choices.map((c) => ({ ...c, prompt, prompts: messages })),
    };
  };

  const fetchCompletion = async (input, model, maxTokens, n) => {
    const response = await createCompletion(prompt, model, maxTokens, n);
    return {
      ...response,
      choices: response.choices.map((c) => ({ ...c, prompt: input })),
    };
  };

  async function createImage(prompt, n) {
    prompt = `Generate an image about "${prompt}". Do not include text in the image.`;
    const resp = await openai.createImage({
      prompt,
      n,
      size: '512x512',
      response_format: 'url',
    });
    return resp.data.data;
  }

  async function generateImageVariant(imageUrl, n) {
    const filename = imageUrl.substring(imageUrl.lastIndexOf('/') + 1);
    const localFilePath = '/tmp/images/' + filename;
    const dirname = path.dirname(localFilePath);
    await fs.promises.mkdir(dirname, { recursive: true });
    await downloadImage(imageUrl, localFilePath);
    const resp = await openai.createImageVariation(
      fs.createReadStream(localFilePath),
      n,
      "1024x1024"
    );
    return resp.data.data;
  }

  async function downloadImage(url, filepath) {
    const resp = await axios({
      method: 'GET',
      url,
      responseType: 'stream'
    });
    return new Promise((resolve, reject) => {
      resp.data.pipe(fs.createWriteStream(filepath))
        .on('error', reject)
        .once('close', () => resolve(filepath));
    });
  }

  return {
    __name,
    createChatCompletion,
    createCompletion,
    fetchChatCompletion,
    fetchCompletion,
    createImage,
    generateImageVariant,
  };

}

module.exports = OpenAILLM;
