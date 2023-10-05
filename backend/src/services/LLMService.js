import {
  fromOpenAIChatResponse,
  fromOpenAICompletionResponse,
  fromVertexAIChatResponse,
  fromVertexAICompletionResponse,
  fromVertexAIEmbeddingResponse,
  toOpenAIChatRequest,
  toOpenAICompletionRequest,
  toVertexAIChatRequest,
  toVertexAICompletionRequest,
  toVertexAIEmbeddingRequest,
  fromLlamaApiChatResponse,
  toLlamaApiChatRequest,
  fromAnthropicChatResponse,
  toAnthropicChatRequest,
} from '../core/conversions/RosettaStone';

export function LLMService({ logger, registry, services }) {

  const { parserService } = services;

  async function createChatCompletion({ provider, request }) {
    const instance = registry[provider || 'openai'];
    let providerRequest;
    if (provider === 'openai' || provider === 'llama2' || provider === 'localai') {
      providerRequest = toOpenAIChatRequest(request);
    } else if (provider === 'bedrock') {
      providerRequest = toAnthropicChatRequest(request);
    } else if (provider === 'llamaapi') {
      providerRequest = toLlamaApiChatRequest(request);
    } else if (provider === 'vertexai') {
      providerRequest = toVertexAIChatRequest(request);
    } else {
      throw new Error(`model provider ${provider} not supported.`);
    }
    logger.debug('provider request:', providerRequest);
    const response = await instance.createChatCompletion(providerRequest);
    logger.debug('provider response:', response);
    if (provider === 'openai' || provider === 'llama2' || provider === 'localai') {
      return fromOpenAIChatResponse(response);
    }
    if (provider === 'bedrock') {
      const universalResponse = await fromAnthropicChatResponse(response, parserService);
      return {
        ...universalResponse,
        model: request.model,
      };
    }
    if (provider === 'llamaapi') {
      return fromLlamaApiChatResponse(response);
    }
    if (provider === 'vertexai') {
      const universalResponse = await fromVertexAIChatResponse(response, parserService);
      return {
        ...universalResponse,
        model: request.model,
      };
    }
    throw new Error('should not be able to get here');
  }

  async function createCompletion({ provider, request }) {
    const instance = registry[provider || 'openai'];
    let providerRequest;
    if (provider === 'openai' || provider === 'llama2' || provider === 'localai') {
      providerRequest = toOpenAICompletionRequest(request);
    } else if (provider === 'llamaapi') {
      providerRequest = toLlamaApiChatRequest(request);
    } else if (provider === 'vertexai') {
      providerRequest = toVertexAICompletionRequest(request);
    } else {
      throw new Error(`model provider ${provider} not supported.`);
    }
    logger.debug('provider request:', providerRequest);
    const response = await instance.createCompletion(providerRequest);
    logger.debug('provider response:', response);
    if (provider === 'openai' || provider === 'llama2' || provider === 'localai' || provider === 'llamaapi') {
      return await fromOpenAICompletionResponse(response, parserService);
    }
    if (provider === 'llamaapi') {
      return fromLlamaApiChatResponse(response);
    }
    if (provider === 'vertexai') {
      const universalResponse = await fromVertexAICompletionResponse(response, parserService);
      return {
        ...universalResponse,
        model: request.model,
      };
    }
    throw new Error('should not be able to get here');
  }

  async function createEmbedding(provider, request) {
    const instance = registry[provider || 'openai'];
    let providerRequest;
    if (provider === 'openai' || provider === 'llama2' || provider === 'localai') {
      providerRequest = request;
    } else if (provider === 'vertexai') {
      providerRequest = toVertexAIEmbeddingRequest(request);
    } else {
      throw new Error(`model provider ${provider} not supported.`);
    }
    const response = await await instance.createEmbedding(providerRequest);
    if (provider === 'openai' || provider === 'llama2' || provider === 'localai') {
      return response;
    }
    if (provider === 'vertexai') {
      return fromVertexAIEmbeddingResponse(response);
    }
    throw new Error('should not be able to get here');
  }

  async function createImage(provider, prompt, n) {
    const instance = registry[provider || 'openai'];
    return await instance.createImage(prompt, n);
  }

  async function generateImageVariant(imageUrl, n) {
    const instance = registry[provider || 'openai'];
    return await instance.generateImageVariant(imageUrl, n);
  }

  function getChatProviders() {
    return Object.entries(registry).map(([key, p]) => ({
      key,
      name: p.__name,
    }));
  }

  function getCompletionProviders() {
    return Object.entries(registry).map(([key, p]) => ({
      key,
      name: p.__name,
    }));
  }

  return {
    createChatCompletion,
    createCompletion,
    createEmbedding,
    getChatProviders,
    getCompletionProviders,
    createImage,
    generateImageVariant,
  }

}
