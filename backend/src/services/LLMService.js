import {
  fromOpenAIChatResponse,
  fromOpenAICompletionResponse,
  fromVertexAIChatResponse,
  fromVertexAICompletionResponse,
  toOpenAIChatRequest,
  toOpenAICompletionRequest,
  toVertexAIChatRequest,
  toVertexAICompletionRequest,
} from '../core/RosettaStone';

export function LLMService({ logger, registry }) {

  async function createChatCompletion({ provider, request }) {
    const instance = registry[provider || 'openai'];
    let providerRequest;
    if (provider === 'openai' || provider === 'llama2' || provider === 'localai') {
      providerRequest = toOpenAIChatRequest(request);
    } else if (provider === 'vertexai') {
      providerRequest = toVertexAIChatRequest(request);
    } else {
      throw new Error(`model provider ${provider} not supported.`);
    }
    const response = await instance.createChatCompletion(providerRequest);
    if (provider === 'openai' || provider === 'llama2' || provider === 'localai') {
      return fromOpenAIChatResponse(response);
    }
    if (provider === 'vertexai') {
      return {
        ...fromVertexAIChatResponse(response),
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
    } else if (provider === 'vertexai') {
      providerRequest = toVertexAICompletionRequest(request);
    } else {
      throw new Error(`model provider ${provider} not supported.`);
    }
    const response = await instance.createCompletion(providerRequest);
    if (provider === 'openai' || provider === 'llama2' || provider === 'localai') {
      return fromOpenAICompletionResponse(response);
    }
    if (provider === 'vertexai') {
      return {
        ...fromVertexAICompletionResponse(response),
        model: request.model,
      };
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
    getChatProviders,
    getCompletionProviders,
    createImage,
    generateImageVariant,
  }

}
