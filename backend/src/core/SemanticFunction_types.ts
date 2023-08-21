import { Validator } from './common_types';
import { Callback } from './Callback';
import { ChatResponse, Message, ModelParams } from './RosettaStone';
import { SemanticFunctionImplementation } from './SemanticFunctionImplementation';

export interface SemanticFunctionCallParams {
  args: any;
  history?: Message[],
  modelKey: string;
  modelParams: ModelParams;
  isBatch?: boolean;
  callbacks?: Callback[];
}

export interface SemanticFunctionOnStartResponse extends SemanticFunctionCallParams {
  name: string;
}

export interface SemanticFunctionOnEndParams {
  response?: ChatResponse;
  errors?: any;
}

export interface SemanticFunctionOnEndResponse extends SemanticFunctionOnEndParams {
  name: string;
  response?: ChatResponse;
  errors?: any;
}

export type SemanticFunctionOnStartCallbackFunction = (params: SemanticFunctionOnStartResponse) => void;

export type SemanticFunctionOnEndCallbackFunction = (params: SemanticFunctionOnEndResponse) => void;

export type SemanticFunctionOnErrorCallbackFunction = (errors: any) => void;

export interface SemanticFunctionParams {
  name: string;
  argsSchema: object;
  implementations: SemanticFunctionImplementation[];
  validator?: Validator;
  callbacks?: Callback[];
}
