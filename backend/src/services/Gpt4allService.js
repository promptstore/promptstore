const axios = require('axios');

function Gpt4allService({ constants, logger }) {

  async function createChatCompletion(messages, maxTokens) {
    logger.debug('messages: ', messages);
    const prompt = messages.map((m) => m.content);
    return createCompletion(prompt, maxTokens);
  }

  async function createCompletion(prompt, maxTokens, n) {
    if (Array.isArray(prompt)) {
      prompt = prompt.join('\n');
    }
    const resp = await axios.post(constants.GPT4ALL_API, {
      prompt,
    });
    logger.debug('GPT4all response: ', JSON.stringify(resp.data, null, 2));
    return resp.data;
  }

  return {
    createChatCompletion,
    createCompletion,
  };

}

module.exports = {
  Gpt4allService,
};
