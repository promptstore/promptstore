import axios from 'axios';

function MistralLLM({ __name, constants, logger }) {

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': 'Bearer ' + constants.MISTRAL_API_KEY,
  };

  async function createChatCompletion(request) {
    const url = constants.MISTRAL_API + '/chat/completions';
    const res = await axios.post(url, request, { headers });
    return res.data;
  }

  async function createEmbedding(request) {
    const url = constants.MISTRAL_API + '/embeddings';
    const res = await axios.post(url, request, { headers });
    return res.data;
  }

  function createCompletion(request) {
    return createChatCompletion(request);
  }

  function createImage(prompt, options) {
    throw new Error('Not implemented');
  }

  function generateImageVariant(imageUrl, options) {
    throw new Error('Not implemented');
  }

  return {
    __name,
    createChatCompletion,
    createCompletion,
    createEmbedding,
    createImage,
    generateImageVariant,
  };

}

export default MistralLLM;
