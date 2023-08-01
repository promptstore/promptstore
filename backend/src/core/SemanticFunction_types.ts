import { ChatCompletionResponse, Validator } from './common_types';
import { ModelParams } from './Model_types';
import { SemanticFunctionImplementation } from './SemanticFunctionImplementation';
import { Trace } from './Tracer';

export interface SemanticFunctionCallParams {
  args: any;
  modelKey: string;
  modelParams: ModelParams;
  isBatch: boolean;
}

interface OnSemanticFunctionStartResponse extends SemanticFunctionCallParams {
  trace: Trace;
}

export interface OnSemanticFunctionEndParams {
  response: ChatCompletionResponse;
}

interface OnSemanticFunctionEndResponse extends OnSemanticFunctionEndParams {
  traceRecord: object;
}

export type OnSemanticFunctionStartCallbackFunction = (params: OnSemanticFunctionStartResponse) => void;

export type OnSemanticFunctionEndCallbackFunction = (params: OnSemanticFunctionEndResponse) => void;

export type OnSemanticFunctionErrorCallbackFunction = (errors: any) => void;

export interface SemanticFunctionParams {
  name: string;
  argsSchema: object;
  implementations: SemanticFunctionImplementation[];
  validator?: Validator;
  onSemanticFunctionStart?: OnSemanticFunctionStartCallbackFunction;
  onSemanticFunctionEnd?: OnSemanticFunctionEndCallbackFunction;
  onSemanticFunctionError?: OnSemanticFunctionErrorCallbackFunction;
}
