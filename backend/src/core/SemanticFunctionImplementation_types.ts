import { ChatCompletionResponse, DataMapper } from './common_types';
import { Callback } from './Callback';
import { Model, ModelParams } from './Model_types';
import { IMessage } from './PromptTemplate_types';
import { PromptEnrichmentPipeline } from './PromptEnrichmentPipeline';
// import { Trace } from './Tracer';

export interface SemanticFunctionImplementationCallParams {
  args: any;
  history?: IMessage[];
  modelKey: string;
  modelParams: ModelParams;
  isBatch?: boolean;
  callbacks?: Callback[];
}

export interface SemanticFunctionImplementationOnStartResponse extends SemanticFunctionImplementationCallParams {
  modelType: string;
  // trace: Trace;
}

export interface SemanticFunctionImplementationOnEndParams {
  response?: ChatCompletionResponse;
  errors?: any;
}

export interface SemanticFunctionImplementationOnEndResponse extends SemanticFunctionImplementationOnEndParams {
  modelKey: string;
  response?: ChatCompletionResponse;
  errors?: any;
  // trace: Trace;
}

export type SemanticFunctionImplementationOnStartCallbackFunction = (params: SemanticFunctionImplementationOnStartResponse) => void;

export type SemanticFunctionImplementationOnEndCallbackFunction = (params: SemanticFunctionImplementationOnEndResponse) => void;

export type SemanticFunctionImplementationOnErrorCallbackFunction = (errors: any) => void;

export interface SemanticFunctionImplementationParams {
  model: Model;
  argsMappingTemplate?: any;
  isDefault: boolean;
  promptEnrichmentPipeline?: PromptEnrichmentPipeline;
  dataMapper?: DataMapper;
  callbacks?: Callback[];
}
