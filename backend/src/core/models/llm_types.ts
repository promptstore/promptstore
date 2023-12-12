import { Model } from '../common_types';
import { Callback } from '../callbacks/Callback';
import {
  ChatRequest,
  ChatResponse,
  EmbeddingRequest,
  EmbeddingResponse,
} from '../conversions/RosettaStone';
import SemanticCache from '../semanticcache/SemanticCache';

export interface LLMService {

  createChatCompletion?(provider: string, request: any, vision: boolean): Promise<ChatResponse>;

  createCompletion?(provider: string, request: any): Promise<ChatResponse>;

  createEmbedding?(provider: string, request: EmbeddingRequest): Promise<EmbeddingResponse>;

  createImage?(provider: string, prompt: string, options: any): Promise<any>;

  generateImageVariant?(provider: string, imageUrl: string, options: any): Promise<any>;

  getChatProviders(): Array<any>

  getCompletionProviders(): Array<any>

  getEmbeddingProviders(): Array<any>

}

export interface LLM {

  __name: string;

  createChatCompletion(request: any, vision?: boolean): Promise<any>;

  createCompletion(request: any): Promise<any>;

  createEmbedding(request: any): Promise<any>;

  createImage(prompt: string, options: any): Promise<any>;

  generateImageVariant(imageUrl: string, options: any): Promise<any>;

}

export interface LLMModel extends Model {
  contextWindow: number;
}

export type CompletionService = (provider: string, request: ChatRequest, vision?: boolean) => Promise<ChatResponse>;

export interface LLMChatModelParams {
  modelType: string;
  model: string;
  provider: string;
  contextWindow: number;
  completionService: CompletionService;
  semanticCache?: SemanticCache;
  semanticCacheEnabled?: boolean;
  callbacks?: Callback[];
}

export interface ModelCallParams {
  request: ChatRequest;
  vision?: boolean;
  callbacks?: Callback[];
}

export interface ModelOnStartResponse {
  request: ChatRequest;
}

export interface ModelOnEndParams {
  model: string;
  response?: ChatResponse;
  errors?: any;
}

export interface ModelOnEndResponse {
  model: string;
  response?: ChatResponse;
  errors?: any;
}

export type ModelOnStartCallbackFunction = (params: ModelOnStartResponse) => void;

export type ModelOnEndCallbackFunction = (params: ModelOnEndResponse) => void;

export type ModelOnErrorCallbackFunction = (errors: any) => void;

export interface CacheResponse {
  model: string;
  prompt: string;
  hit: boolean;
  response?: ChatResponse;
}
