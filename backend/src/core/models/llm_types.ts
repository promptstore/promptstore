import { Callback } from '../Callback';
import {
  ChatRequest,
  ChatResponse,
  ProviderRequest,
} from '../RosettaStone';

export type CompletionService = ({ provider, request }: ProviderRequest) => Promise<ChatResponse>;

export interface LLMChatModelParams {
  modelType: string;
  model: string;
  provider: string;
  completionService: CompletionService;
  callbacks?: Callback[];
}

export interface ModelCallParams {
  request: ChatRequest;
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
