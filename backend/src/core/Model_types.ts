import { ChatCompletionResponse } from './common_types';
import { Message } from './PromptTemplate_types';
import { Trace } from './Tracer';

interface OnModelStartResponse {
  messages: Message[];
  modelKey: string;
  modelParams: ModelParams;
  trace: Trace;
}

export interface OnModelEndParams {
  response: ChatCompletionResponse;
}

export interface OnModelEndResponse {
  response: ChatCompletionResponse;
  trace: Trace;
}

export type OnModelStartCallbackFunction = (params: OnModelStartResponse) => void;

export type OnModelEndCallbackFunction = (params: OnModelEndResponse) => void;

export type OnModelErrorCallbackFunction = (errors: any) => void;

export interface ModelParams {
  maxTokens?: number;
  n?: number;
  functions?: any;
  stop?: string;
}

interface ChatCompletionRequest {
  messages: Message[];
  modelKey: string;
  modelParams: ModelParams;
};

export type ChatCompletionService = (request: ChatCompletionRequest) => Promise<ChatCompletionResponse>;

export interface LLMChatModelParams {
  modelKey: string;
  chatCompletionService: ChatCompletionService;
  onModelStart?: OnModelStartCallbackFunction;
  onModelEnd?: OnModelEndCallbackFunction;
  onModelError?: OnModelErrorCallbackFunction;
}

export interface ModelCallParams {
  messages: Message[];
  modelKey: string;
  modelParams: ModelParams;
}

export interface Model {
  modelKey: string;
  call: (params: ModelCallParams) => Promise<ChatCompletionResponse>;
  onModelStart?: OnModelStartCallbackFunction;
  onModelEnd?: OnModelEndCallbackFunction;
  onModelError?: OnModelErrorCallbackFunction;
}
