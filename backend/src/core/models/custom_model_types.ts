import { Callback } from '../Callback';

export interface CustomModelParams {
  modelType: string;
  model: string;
  url?: string;
  batchEndpoint?: string;
  callbacks?: Callback[];
}

export interface CustomModelCallParams {
  args: any;
  isBatch: boolean;
  callbacks?: Callback[];
}

export interface CustomModelOnStartResponse {
  model: string;
  url: string;
  args: any;
  isBatch: boolean;
}

export interface CustomModelOnEndParams {
  response?: any;
  errors?: any;
}

export interface CustomModelOnEndResponse {
  model: string;
  response?: any;
  errors?: any;
}

export type CustomModelOnStartCallbackFunction = (params: CustomModelOnStartResponse) => void;

export type CustomModelOnEndCallbackFunction = (params: CustomModelOnEndResponse) => void;

export type CustomModelOnErrorCallbackFunction = (errors: any) => void;
