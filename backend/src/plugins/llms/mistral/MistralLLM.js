import axios from 'axios';

import {
  fromOpenAIChatResponse,
} from '../../../core/conversions/RosettaStone';

import {
  toMistralChatRequest,
  toMistralEmbeddingRequest,
} from './conversions';

function MistralLLM({ __name, constants, logger }) {

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': 'Bearer ' + constants.MISTRAL_API_KEY,
  };

  async function createChatCompletion(request, parserService) {
    const req = toMistralChatRequest(request);
    const url = constants.MISTRAL_API + '/chat/completions';
    const res = await axios.post(url, req, { headers });
    const response = await fromOpenAIChatResponse(res.data, parserService);
    return {
      ...response,
      model: request.model,
    };
  }

  async function createEmbedding(request) {
    const req = toMistralEmbeddingRequest(request);
    const url = constants.MISTRAL_API + '/embeddings';
    const res = await axios.post(url, req, { headers });
    return res.data;
  }

  function createCompletion(request) {
    return createChatCompletion(request);
  }

  function getNumberTokens(model, text) {
    throw new Error('Not implemented');
  }

  return {
    __name,
    createChatCompletion,
    createCompletion,
    createEmbedding,
    getNumberTokens,
  };

}

export default MistralLLM;
