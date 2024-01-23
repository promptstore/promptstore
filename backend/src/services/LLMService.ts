import {
  ChatRequest,
  EmbeddingRequest,
  toAnthropicChatRequest,
  toCohereChatRequest,
  fromCohereChatResponse,
  toGeminiChatRequest,
  fromGeminiChatResponse,
  toLlamaApiChatRequest,
  fromLlamaApiChatResponse,
  toMistralChatRequest,
  toMistralEmbeddingRequest,
  toOpenAIChatRequest,
  toOpenAICompletionRequest,
  toVertexAIChatRequest,
  toVertexAICompletionRequest,
  toVertexAIEmbeddingRequest,
  fromOpenAIChatResponse,
  fromOpenAICompletionResponse,
  fromVertexAIChatResponse,
  fromVertexAICompletionResponse,
  fromVertexAIEmbeddingResponse,
  fromAnthropicChatResponse,
} from '../core/conversions/RosettaStone';
import { PluginServiceParams } from '../core/indexers/Plugin';
import { PluginMetadata } from '../core/indexers/common_types';
import { LLM, LLMService } from '../core/models/llm_types';

const OPENAI_COMPATIBLE_PROVIDERS = ['openai', 'llama2', 'localai'];

export function LLMService({ logger, registry, services }: PluginServiceParams): LLMService {

  const { parserService } = services;

  async function createChatCompletion(provider: string, request: ChatRequest) {
    logger.debug('chat provider:', provider);
    const instance = registry[provider] as LLM;

    let providerRequest: any;
    if (OPENAI_COMPATIBLE_PROVIDERS.includes(provider)) {
      providerRequest = toOpenAIChatRequest(request);

    } else if (provider === 'bedrock') {
      if (request.model.startsWith('anthropic')) {
        providerRequest = toAnthropicChatRequest(request);
      } else if (request.model.startsWith('cohere')) {
        providerRequest = toCohereChatRequest(request);
      } else {
        throw new Error('unknown bedrock model: ' + request.model);
      }

    } else if (provider === 'gemini') {
      providerRequest = toGeminiChatRequest(request);

    } else if (provider === 'llamaapi') {
      providerRequest = toLlamaApiChatRequest(request);

    } else if (provider === 'mistral') {
      providerRequest = toMistralChatRequest(request);

    } else if (provider === 'vertexai') {
      providerRequest = toVertexAIChatRequest(request);

    } else {
      throw new Error(`model provider ${provider} not supported.`);
    }

    // logger.debug('provider request:', providerRequest);
    const response = await instance.createChatCompletion(providerRequest);
    // logger.debug('provider response:', response);

    if ([...OPENAI_COMPATIBLE_PROVIDERS, 'mistral'].includes(provider)) {
      // because the OpenAI GPT-4V model only accepts the key `gpt-4-vision-preview`,
      // but returns the key `gpt-4-1106-vision-preview`
      const universalResponse = await fromOpenAIChatResponse(response, parserService);
      return {
        ...universalResponse,
        model: request.model,
      };
    }
    if (provider === 'bedrock') {
      if (request.model.startsWith('anthropic')) {
        const universalResponse = await fromAnthropicChatResponse(response, parserService);
        const model = request.model;
        const prompt_tokens = instance.getNumberTokens(model, providerRequest.body.prompt);
        const completion_tokens = instance.getNumberTokens(model, response.completion);
        const total_tokens = prompt_tokens + completion_tokens;
        return {
          ...universalResponse,
          model,
          usage: { prompt_tokens, completion_tokens, total_tokens },
        };

      } else if (request.model.startsWith('cohere')) {
        const universalResponse = await fromCohereChatResponse(response, parserService);
        return {
          ...universalResponse,
          model: request.model,
        };

      } else {
        throw new Error('unknown model: ' + request.model);
      }
    }

    if (provider === 'gemini') {
      const universalResponse = fromGeminiChatResponse(response);
      return {
        ...universalResponse,
        model: request.model,
      };
    }

    if (provider === 'llamaapi') {
      const universalResponse = fromLlamaApiChatResponse(response);
      return {
        ...universalResponse,
        model: request.model,
      };
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

  async function createCompletion(provider: string, request: ChatRequest) {
    logger.debug('completion provider:', provider);
    const instance = registry[provider] as LLM;

    let providerRequest: any;
    if (OPENAI_COMPATIBLE_PROVIDERS.includes(provider)) {
      providerRequest = toOpenAICompletionRequest(request);

    } else if (provider === 'llamaapi') {
      providerRequest = toLlamaApiChatRequest(request);

    } else if (provider === 'vertexai') {
      providerRequest = toVertexAICompletionRequest(request);

    } else {
      throw new Error(`model provider ${provider} not supported.`);
    }

    // logger.debug('provider request:', providerRequest);
    const response = await instance.createCompletion(providerRequest);
    // logger.debug('provider response:', response);

    if (provider === 'openai' || provider === 'llama2' || provider === 'localai') {
      return fromOpenAICompletionResponse(response, parserService);
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

  async function createEmbedding(provider: string, request: EmbeddingRequest) {
    const instance = registry[provider] as LLM;

    let providerRequest: any;
    if ([...OPENAI_COMPATIBLE_PROVIDERS, 'sentenceencoder'].includes(provider)) {
      providerRequest = request;

    } else if (provider === 'mistral') {
      providerRequest = toMistralEmbeddingRequest(request);

    } else if (provider === 'vertexai') {
      providerRequest = toVertexAIEmbeddingRequest(request);

    } else {
      throw new Error(`model provider ${provider} not supported.`);
    }

    // logger.debug('provider request:', providerRequest);
    const response = await instance.createEmbedding(providerRequest);
    // logger.debug('provider response:', response);

    if ([...OPENAI_COMPATIBLE_PROVIDERS, 'sentenceencoder', 'mistral'].includes(provider)) {
      return response;
    }

    if (provider === 'vertexai') {
      const universalResponse = fromVertexAIEmbeddingResponse(response);
      return {
        ...universalResponse,
        model: request.model,
      };

    }

    throw new Error('should not be able to get here');
  }

  async function createImage(provider: string, prompt: string, options: any) {
    const instance = registry[provider] as LLM;
    return await instance.createImage(prompt, options);
  }

  async function generateImageVariant(provider: string, imageUrl: string, options: any) {
    const instance = registry[provider] as LLM;
    return await instance.generateImageVariant(imageUrl, options);
  }

  function getNumberTokens(provider: string, model: string, text: string) {
    const instance = registry[provider] as LLM;
    return instance.getNumberTokens(model, text);
  }

  function getChatProviders(): PluginMetadata[] {
    return Object.entries(registry)
      .filter(([_, p]) => 'createChatCompletion' in p)
      .map(([key, p]) => ({
        key,
        name: p.__name,
      }));
  }

  function getCompletionProviders() {
    return Object.entries(registry)
      .filter(([_, p]) => 'createCompletion' in p)
      .map(([key, p]) => ({
        key,
        name: p.__name,
      }));
  }

  function getEmbeddingProviders() {
    return Object.entries(registry)
      .filter(([_, p]) => 'createEmbedding' in p)
      .map(([key, p]) => ({
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
    getEmbeddingProviders,
    createImage,
    generateImageVariant,
    getNumberTokens,
  }

}
