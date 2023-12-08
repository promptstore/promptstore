import { Model } from '../common_types';
import { Callback } from '../callbacks/Callback';
import {
  ChatRequest,
  ChatResponse,
  ProviderRequest,
} from '../conversions/RosettaStone';
import SemanticCache from '../semanticcache/SemanticCache';

export interface LLMModel extends Model {
  contextWindow: number;
}

export type CompletionService = ({ provider, request, vision }: ProviderRequest) => Promise<ChatResponse>;

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
