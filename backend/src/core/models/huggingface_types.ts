import { Callback } from '../Callback';

export interface HuggingfaceModelParams {
  modelType: string;
  model: string;
  modelProviderService: any;
  callbacks?: Callback[];
}

export interface HuggingfaceModelCallParams {
  args: any;
  callbacks?: Callback[];
}

export interface HuggingfaceModelOnStartResponse {
  model: string;
  args: any;
}

export interface HuggingfaceModelOnEndParams {
  response?: any;
  errors?: any;
}

export interface HuggingfaceModelOnEndResponse {
  model: string;
  response?: any;
  errors?: any;
}

export type HuggingfaceModelOnStartCallbackFunction = (params: HuggingfaceModelOnStartResponse) => void;

export type HuggingfaceModelOnEndCallbackFunction = (params: HuggingfaceModelOnEndResponse) => void;

export type HuggingfaceModelOnErrorCallbackFunction = (errors: any) => void;
