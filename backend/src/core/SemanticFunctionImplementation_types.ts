import { ChatCompletionResponse, DataMapper } from './common_types';
import { Model, ModelParams } from './Model_types';
import { PromptEnrichmentPipeline } from './PromptEnrichmentPipeline';
import { Trace } from './Tracer';

export interface SemanticFunctionImplementationCallParams {
  args: any;
  modelKey: string;
  modelParams: ModelParams;
  isBatch: boolean;
}

interface OnSemanticFunctionImplementationStartResponse extends SemanticFunctionImplementationCallParams {
  trace: Trace;
}

export interface OnSemanticFunctionImplementationEndParams {
  response: ChatCompletionResponse;
}

interface OnSemanticFunctionImplementationEndResponse extends OnSemanticFunctionImplementationEndParams {
  trace: Trace;
}

export type OnSemanticFunctionImplementationStartCallbackFunction = (params: OnSemanticFunctionImplementationStartResponse) => void;

export type OnSemanticFunctionImplementationEndCallbackFunction = (params: OnSemanticFunctionImplementationEndResponse) => void;

export type OnSemanticFunctionImplementationErrorCallbackFunction = (errors: any) => void;

export interface SemanticFunctionImplementationParams {
  model: Model;
  promptEnrichmentPipeline: PromptEnrichmentPipeline;
  isDefault: boolean;
  argsMappingTemplate?: any;
  dataMapper?: DataMapper;
  onSemanticFunctionImplementationStart?: OnSemanticFunctionImplementationStartCallbackFunction;
  onSemanticFunctionImplementationEnd?: OnSemanticFunctionImplementationEndCallbackFunction;
  onSemanticFunctionImplementationError?: OnSemanticFunctionImplementationErrorCallbackFunction;
}
