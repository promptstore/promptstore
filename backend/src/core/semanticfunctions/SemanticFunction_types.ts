import { Validator } from '../common_types';
import { Callback } from '../callbacks/Callback';
import {
  ChatResponse,
  Function,
  Message,
  ModelObject,
  ModelParams,
  ResponseMetadata,
} from '../conversions/RosettaStone';
import { SemanticFunctionImplementation } from './SemanticFunctionImplementation';

export interface SemanticFunctionCallParams {
  args: any;
  messages?: Message[];
  history?: Message[],
  extraSystemPrompt?: string;
  model?: ModelObject;
  modelParams: Partial<ModelParams>;
  functions?: Function[];
  isBatch?: boolean;
  options?: any;
  callbacks?: Callback[];
}

export interface SemanticFunctionOnStartResponse extends SemanticFunctionCallParams {
  name: string;
  experiments?: Experiment[];
}

export interface SemanticFunctionOnEndParams {
  errors: any;
  response: ChatResponse;
  responseMetadata: Partial<ResponseMetadata>;
}

export interface SemanticFunctionOnEndResponse extends SemanticFunctionOnEndParams {
  name: string;
}

export type SemanticFunctionOnStartCallbackFunction = (params: SemanticFunctionOnStartResponse) => void;

export type SemanticFunctionOnEndCallbackFunction = (params: Partial<SemanticFunctionOnEndResponse>) => void;

export type SemanticFunctionOnErrorCallbackFunction = (errors: any) => void;

export interface Experiment {
  name?: string;
  percentage: number;
}

export interface SemanticFunctionParams {
  id: number;
  name: string;
  description: string;
  argsSchema?: object;
  returnType: string;
  returnTypeSchema?: object;
  experiments?: Experiment[];
  implementations: SemanticFunctionImplementation[];
  validator?: Validator;
  callbacks?: Callback[];
}

export interface ExperimentResponse {
  experiments: Experiment[];
  implementation: string;
}
