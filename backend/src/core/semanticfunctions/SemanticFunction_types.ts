import { Validator } from '../common_types';
import { Callback } from '../callbacks/Callback';
import { ChatResponse, Message, ModelParams } from '../conversions/RosettaStone';
import { SemanticFunctionImplementation } from './SemanticFunctionImplementation';

export interface SemanticFunctionCallParams {
  args: any;
  history?: Message[],
  modelKey?: string;
  modelParams: ModelParams;
  isBatch?: boolean;
  callbacks?: Callback[];
}

export interface SemanticFunctionOnStartResponse extends SemanticFunctionCallParams {
  name: string;
  experiments?: Experiment[];
}

export interface SemanticFunctionOnEndParams {
  response?: ChatResponse;
  errors?: any;
  implementation?: string;
}

export interface SemanticFunctionOnEndResponse extends SemanticFunctionOnEndParams {
  name: string;
  response?: ChatResponse;
  errors?: any;
}

export type SemanticFunctionOnStartCallbackFunction = (params: SemanticFunctionOnStartResponse) => void;

export type SemanticFunctionOnEndCallbackFunction = (params: SemanticFunctionOnEndResponse) => void;

export type SemanticFunctionOnErrorCallbackFunction = (errors: any) => void;

export interface Experiment {
  name?: string;
  percentage: number;
}

export interface SemanticFunctionParams {
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
