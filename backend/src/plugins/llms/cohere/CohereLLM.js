import { CohereClient } from 'cohere-ai';

import {
  fromCohereChatResponse,
  fromCohereEmbeddingResponse,
  toCohereChatRequest,
  toCohereEmbeddingRequest,
} from './conversions';

function CohereLLM({ __name, constants, logger }) {

  let _client;

  function getClient() {
    if (!_client) {
      _client = new CohereClient({
        token: constants.COHERE_API_KEY,
      });
    }
    return _client;
  }

  async function createChatCompletion(request) {
    const client = await getClient();
    const req = toCohereChatRequest(request);
    const response = await client.chat(req);
    return {
      ...fromCohereChatResponse(response),
      model: request.model,
    };
  }

  async function createEmbedding(request) {
    const client = await getClient();
    const req = toCohereEmbeddingRequest(request);
    const response = await client.embed(req);
    return {
      ...fromCohereEmbeddingResponse(response),
      model: request.model,
    };
  }

  async function rerank(model, documents, query, topN = 3) {
    const client = await getClient();
    return client.rerank({
      model,
      documents: documents.map(text => ({ text })),
      query,
      topN,
    });
  }

  async function createCompletion(request) {
    const client = await getClient();
    return client.generate(request);
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
    rerank,
  };

}

export default CohereLLM;
