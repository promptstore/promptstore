import { Model } from '../common_types';
import { Callback } from '../callbacks/Callback';
import {
  ChatRequest,
  ChatResponse,
  EmbeddingRequest,
  EmbeddingResponse,
} from '../conversions/RosettaStone';
import {
  ParserService,
} from '../outputprocessing/OutputProcessingPipeline_types';
import SemanticCache from '../semanticcache/SemanticCache';

export interface LLMService {

  createChatCompletion?(provider: string, request: ChatRequest, parserService: ParserService): Promise<ChatResponse>;

  createCompletion?(provider: string, request: ChatRequest, parserService: ParserService): Promise<ChatResponse>;

  createEmbedding?(provider: string, request: EmbeddingRequest): Promise<EmbeddingResponse>;

  createImage?(provider: string, prompt: string, options: any): Promise<any>;

  generateImageVariant?(provider: string, imageUrl: string, options: any): Promise<any>;

  getNumberTokens(provider: string, model: string, text: string): number;

  rerank(provider: string, model: string, documents: string[], query: string, topN: number): any;

  getAllProviders(): Array<any>

  getChatProviders(): Array<any>

  getCompletionProviders(): Array<any>

  getEmbeddingProviders(): Array<any>

  getRerankerProviders(): Array<any>

}

export interface LLM {

  __name: string;

  createChatCompletion(request: ChatRequest, parserService: ParserService): Promise<ChatResponse>;

  createCompletion(request: ChatRequest, parserService: ParserService): Promise<ChatResponse>;

  createEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse>;

  createImage(prompt: string, options: any): Promise<any>;

  generateImageVariant(imageUrl: string, options: any): Promise<any>;

  getNumberTokens(model: string, text: string): number;

  rerank(model: string, documents: string[], query: string, topN: number): any;

}

export interface LLMModel extends Model {
  contextWindow: number;
  maxOutputTokens: number;
}

export type CompletionService = (provider: string, request: ChatRequest) => Promise<ChatResponse>;

export interface LLMChatModelParams {
  modelId: number;
  modelName: string;
  modelType: string;
  model: string;
  provider: string;
  contextWindow: number;
  maxOutputTokens: number;
  completionService: CompletionService;
  semanticCache?: SemanticCache;
  semanticCacheEnabled?: boolean;
  callbacks?: Callback[];
}

export interface ModelCallParams {
  provider?: string;
  request: ChatRequest;
  callbacks?: Callback[];
}

export interface ModelOnStartResponse {
  modelId?: number;
  modelName?: string;
  provider: string;
  request: ChatRequest;
}

export interface ModelOnEndParams {
  errors?: any;
  response?: ChatResponse;
}

export interface ModelOnEndResponse {
  errors?: any;
  response?: ChatResponse;
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
