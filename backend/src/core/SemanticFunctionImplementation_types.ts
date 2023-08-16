import { ChatCompletionResponse, DataMapper } from './common_types';
import { Callback } from './Callback';
import { InputGuardrails } from './InputGuardrails';
import { Model, ModelParams } from './Model_types';
import { OutputProcessingPipeline } from './OutputProcessingPipeline';
import { IMessage } from './PromptTemplate_types';
import { PromptEnrichmentPipeline } from './PromptEnrichmentPipeline';

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
}

export interface SemanticFunctionImplementationOnEndParams {
  response?: ChatCompletionResponse;
  errors?: any;
}

export interface SemanticFunctionImplementationOnEndResponse extends SemanticFunctionImplementationOnEndParams {
  modelKey: string;
  response?: ChatCompletionResponse;
  errors?: any;
}

export type SemanticFunctionImplementationOnStartCallbackFunction = (params: SemanticFunctionImplementationOnStartResponse) => void;

export type SemanticFunctionImplementationOnEndCallbackFunction = (params: SemanticFunctionImplementationOnEndResponse) => void;

export type SemanticFunctionImplementationOnErrorCallbackFunction = (errors: any) => void;

export interface SemanticFunctionImplementationParams {
  model: Model;
  argsMappingTemplate?: any;
  returnMappingTemplate?: any;
  isDefault: boolean;
  promptEnrichmentPipeline?: PromptEnrichmentPipeline;
  inputGuardrails?: InputGuardrails;
  outputProcessingPipeline?: OutputProcessingPipeline;
  dataMapper?: DataMapper;
  callbacks?: Callback[];
}
