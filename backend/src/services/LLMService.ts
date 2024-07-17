import { PluginMetadata } from '../core/common_types';
import {
  ChatRequest,
  EmbeddingRequest,
} from '../core/conversions/RosettaStone';
import { PluginServiceParams } from '../core/indexers/Plugin';
import { LLM, LLMService } from '../core/models/llm_types';

export function LLMService({ logger, registry, services }: PluginServiceParams): LLMService {

  const { parserService } = services;

  function createChatCompletion(provider: string, request: ChatRequest) {
    logger.debug('chat provider:', provider);
    // logger.debug('request:', request);
    const instance = registry[provider] as LLM;
    return instance.createChatCompletion(request, parserService);
  }

  function createCompletion(provider: string, request: ChatRequest) {
    logger.debug('completion provider:', provider);
    const instance = registry[provider] as LLM;
    return instance.createCompletion(request, parserService);
  }

  function createEmbedding(provider: string, request: EmbeddingRequest) {
    const instance = registry[provider] as LLM;
    return instance.createEmbedding(request);
  }

  async function createImage(provider: string, prompt: string, options: any) {
    const instance = registry[provider] as LLM;
    return await instance.createImage(prompt, options);
  }

  async function generateImageVariant(provider: string, imageUrl: string, options: any) {
    const instance = registry[provider] as LLM;
    return await instance.generateImageVariant(imageUrl, options);
  }

  async function editImage(provider: string, imageUrl: string, prompt: string, options: any) {
    const instance = registry[provider] as LLM;
    return await instance.editImage(imageUrl, prompt, options);
  }

  function getNumberTokens(provider: string, model: string, text: string) {
    const instance = registry[provider] as LLM;
    return instance.getNumberTokens(model, text);
  }

  function rerank(provider: string, model: string, documents: string[], query: string, topN: number) {
    const instance = registry[provider] as LLM;
    return instance.rerank(model, documents, query, topN);
  }

  function getAllProviders() {
    return Object.entries(registry)
      .map(([key, p]) => ({
        key,
        name: p.__name,
      }));
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

  function getRerankerProviders() {
    return Object.entries(registry)
      .filter(([_, p]) => 'rerank' in p)
      .map(([key, p]) => ({
        key,
        name: p.__name,
      }));
  }

  function getImageProviders() {
    return Object.entries(registry)
      .filter(([_, p]) => 'createImage' in p)
      .map(([key, p]) => ({
        key,
        name: p.__name,
      }));
  }

  return {
    createChatCompletion,
    createCompletion,
    createEmbedding,
    editImage,
    rerank,
    getAllProviders,
    getChatProviders,
    getCompletionProviders,
    getEmbeddingProviders,
    getImageProviders,
    getRerankerProviders,
    createImage,
    generateImageVariant,
    getNumberTokens,
  }

}
