const { Configuration, OpenAIApi } = require('openai');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const { delay } = require('./utils');

function OpenAILLM({ constants, logger }) {

  const configuration = new Configuration({
    apiKey: constants.OPENAI_API_KEY,
  });

  const openai = new OpenAIApi(configuration);

  async function createChatCompletion(messages, model, maxTokens, n, retryCount = 0) {
    let resp;
    try {
      const options = {
        model,
        messages,
        max_tokens: maxTokens,
        n,
      };
      // logger.debug('options: ', JSON.stringify(options, null, 2));
      resp = await openai.createChatCompletion(options);
      logger.debug('OpenAI response: ', JSON.stringify(resp.data, null, 2));
      return resp.data;
    } catch (err) {
      logger.error(String(err));
      if (resp && resp.data.error?.message.startsWith('That model is currently overloaded with other requests')) {
        if (retryCount > 2) {
          throw new Error('Exceeded retry count: ' + String(err), { cause: err });
        }
        await delay(2000);
        return await createChatCompletion(messages, maxTokens, n, retryCount + 1);
      }
    }
  }

  async function createCompletion(prompt, model, maxTokens, n) {
    const resp = await openai.createCompletion({
      model,
      prompt,
      max_tokens: maxTokens,
      n,
    });
    logger.debug('OpenAI response: ', JSON.stringify(resp.data, null, 2));
    return resp.data.choices;
  }

  async function createImage(prompt, n) {
    prompt = `Generate an image about "${prompt}". Do not include text in the image.`;
    const resp = await openai.createImage({
      prompt,
      n,
      size: '512x512',
      response_format: 'url',
    });
    logger.debug('OpenAI image: ', JSON.stringify(resp.data, null, 2));
    return resp.data.data;
  }

  async function extractKeywords(messages) {
    const { choices } = await createChatCompletion(messages, 50);
    return choices[0].message.content
      .replace(/"/g, '')
      .split(',')
      .map((kw) => kw.trim());
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
      url,
      method: 'GET',
      responseType: 'stream'
    });
    return new Promise((resolve, reject) => {
      resp.data.pipe(fs.createWriteStream(filepath))
        .on('error', reject)
        .once('close', () => resolve(filepath));
    });
  }

  const fetchChatCompletion = async (messages, model, maxTokens, n) => {
    const prompt = messages[messages.length - 1];
    const response = await createChatCompletion(messages, model, maxTokens, n);
    return {
      ...response,
      choices: response.choices.map((c) => ({ ...c, prompt })),
    };
  };

  const fetchCompletion = async (input, model, maxTokens, n) => {
    const response = await createCompletion(prompt, model, maxTokens, n);
    return {
      ...response,
      choices: response.choices.map((c) => ({ ...c, prompt: input })),
    };
  };

  const getSummary = async (messages) => {
    const content = messages.filter((m) => m.role === 'user').map((m) => m.content).join('\n\n');
    const msgs = [
      {
        role: 'user',
        content: `Summarize the following content to a maximum of three words: """${content}"""`,
      }
    ];
    const resp = await createChatCompletion(msgs, 'gpt-3.5-turbo', 10);
    return resp.choices[0].message.content;
  };

  return {
    createChatCompletion,
    createCompletion,
    createImage,
    extractKeywords,
    fetchChatCompletion,
    fetchCompletion,
    generateImageVariant,
    getSummary,
  };

}

module.exports = OpenAILLM;
