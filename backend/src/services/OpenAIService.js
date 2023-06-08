const axios = require('axios');
const fs = require('fs');
const path = require('path');

const { delay, getMessages } = require('../utils');

function OpenAIService({ logger, openai, services }) {

  const {
    gpt4allService,
    promptSetsService,
  } = services;

  async function createChatCompletion(messages, model, maxTokens, hits, retryCount = 0) {
    let resp;
    try {
      let msgs = [...messages];
      if (hits?.length) {
        const context = hits.map(h => h.content_text).join('\n');
        const i = messages.length - 1;
        const content = messages[i].content;
        const promptSets = await promptSetsService.getPromptSetBySkill('qa');
        if (promptSets.length) {
          const prompts = promptSets[0].prompts;
          const features = { context, content };
          msgs.splice(i, 1, ...getMessages(prompts, features));
        }
      }
      logger.debug('messages: ', msgs);
      resp = await openai.createChatCompletion({
        model,
        messages: msgs,
        max_tokens: maxTokens,
      });
      logger.debug('OpenAI response: ', JSON.stringify(resp.data, null, 2));
      return resp.data;
    } catch (err) {
      logger.error(err);
      if (resp && resp.data.error?.message.startsWith('That model is currently overloaded with other requests')) {
        if (retryCount > 2) {
          throw new Error('Exceeded retry count: ' + String(err), { cause: err });
        }
        await delay(2000);
        return await createChatCompletion(messages, maxTokens, retryCount + 1);
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

  const fetchChatCompletion = async (messages, model, maxTokens, n, service) => {
    let response;
    const prompt = messages[messages.length - 1];

    if (service === 'gpt4all') {
      const input = messages.map((m) => m.content).join('\n\n');
      response = await gpt4allService.createCompletion(input, maxTokens, n);
      return response.map((c) => ({ text: c.generation, prompt }));
    }

    response = await createChatCompletion(messages, model, maxTokens, n);
    return {
      ...response,
      choices: response.choices.map((c) => ({ ...c, prompt })),
    };
  };

  const fetchCompletion = async (input, model, maxTokens, n, service) => {
    let response;

    if (service === 'gpt4all') {
      response = await gpt4allService.createCompletion(input, maxTokens, n);
      return response.map((c) => ({ text: c.generation, prompt: input }));
    }

    // openai
    response = await createCompletion(prompt, model, maxTokens, n);
    return {
      ...response,
      choices: response.choices.map((c) => ({ ...c, prompt: input })),
    };
  };

  return {
    createChatCompletion,
    createCompletion,
    createImage,
    extractKeywords,
    fetchChatCompletion,
    fetchCompletion,
    generateImageVariant,
  };

}

module.exports = {
  OpenAIService,
};
