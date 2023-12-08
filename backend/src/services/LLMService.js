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
  fromCohereChatResponse,
  toCohereChatRequest,
} from '../core/conversions/RosettaStone';

export function LLMService({ logger, registry, services }) {

  const { parserService } = services;

  async function createChatCompletion({ provider, request, vision }) {
    logger.debug('!!!!!!!!!!!!!!!!! vision:', vision);
    const instance = registry[provider || 'openai'];
    let providerRequest;
    if (vision) {
      providerRequest = request;
    } else if (provider === 'openai' || provider === 'llama2' || provider === 'localai') {
      providerRequest = toOpenAIChatRequest(request);
    } else if (provider === 'bedrock') {
      if (request.model.startsWith('anthropic')) {
        providerRequest = toAnthropicChatRequest(request);
      } else if (request.model.startsWith('cohere')) {
        providerRequest = toCohereChatRequest(request);
      } else {
        throw new Error('unknown model:', request.model);
      }
    } else if (provider === 'llamaapi') {
      providerRequest = toLlamaApiChatRequest(request);
    } else if (provider === 'vertexai') {
      providerRequest = toVertexAIChatRequest(request);
    } else {
      throw new Error(`model provider ${provider} not supported.`);
    }
    // logger.debug('provider request:', providerRequest);
    const response = await instance.createChatCompletion(providerRequest);
    // logger.debug('provider response:', response);
    if (provider === 'openai' || provider === 'llama2' || provider === 'localai') {
      return fromOpenAIChatResponse(response);
    }
    if (provider === 'bedrock') {
      if (request.model.startsWith('anthropic')) {
        const universalResponse = await fromAnthropicChatResponse(response, parserService);
        return {
          ...universalResponse,
          model: request.model,
        };
      } else if (request.model.startsWith('cohere')) {
        const universalResponse = await fromCohereChatResponse(response, parserService);
        return {
          ...universalResponse,
          model: request.model,
        };
      } else {
        throw new Error('unknown model:', request.model);
      }
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
    // logger.debug('provider request:', providerRequest);
    const response = await instance.createEmbedding(providerRequest);
    // logger.debug('provider response:', response);
    if (provider === 'openai' || provider === 'llama2' || provider === 'localai') {
      return response;
    }
    if (provider === 'vertexai') {
      return fromVertexAIEmbeddingResponse(response);
    }
    throw new Error('should not be able to get here');
  }

  async function createImage(provider, prompt, options) {
    const instance = registry[provider];
    return await instance.createImage(prompt, options);
  }

  async function generateImageVariant(provider, imageUrl, options) {
    const instance = registry[provider];
    return await instance.generateImageVariant(imageUrl, options);
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
