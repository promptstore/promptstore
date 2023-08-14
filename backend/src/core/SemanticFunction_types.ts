import { ChatCompletionResponse, Validator } from './common_types';
import { Callback } from './Callback';
import { ModelParams } from './Model_types';
import { IMessage } from './PromptTemplate_types';
import { SemanticFunctionImplementation } from './SemanticFunctionImplementation';
// import { Trace } from './Tracer';

export interface SemanticFunctionCallParams {
  args: any;
  history?: IMessage[],
  modelKey: string;
  modelParams: ModelParams;
  isBatch?: boolean;
  callbacks?: Callback[];
}

export interface SemanticFunctionOnStartResponse extends SemanticFunctionCallParams {
  name: string;
  // trace: Trace;
}

export interface SemanticFunctionOnEndParams {
  response?: ChatCompletionResponse;
  errors?: any;
}

export interface SemanticFunctionOnEndResponse extends SemanticFunctionOnEndParams {
  name: string;
  response?: ChatCompletionResponse;
  errors?: any;
  // traceRecord: object;
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
