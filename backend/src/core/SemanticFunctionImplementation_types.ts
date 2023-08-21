import { DataMapper, Model } from './common_types';
import { Callback } from './Callback';
import { InputGuardrails } from './InputGuardrails';
import { OutputProcessingPipeline } from './OutputProcessingPipeline';
import { PromptEnrichmentPipeline } from './PromptEnrichmentPipeline';
import { ChatResponse, Message, ModelParams } from './RosettaStone';

export interface SemanticFunctionImplementationCallParams {
  args: any;
  history?: Message[];
  modelKey: string;
  modelParams: ModelParams;
  isBatch?: boolean;
  callbacks?: Callback[];
}

export interface SemanticFunctionImplementationOnStartResponse extends SemanticFunctionImplementationCallParams {
  modelType: string;
}

export interface SemanticFunctionImplementationOnEndParams {
  response?: ChatResponse;
  errors?: any;
}

export interface SemanticFunctionImplementationOnEndResponse extends SemanticFunctionImplementationOnEndParams {
  modelKey: string;
  response?: ChatResponse;
  errors?: any;
}

export type SemanticFunctionImplementationOnStartCallbackFunction = (params: SemanticFunctionImplementationOnStartResponse) => void;

export type SemanticFunctionImplementationOnEndCallbackFunction = (params: SemanticFunctionImplementationOnEndResponse) => void;

export type SemanticFunctionImplementationOnErrorCallbackFunction = (errors: any) => void;

export interface SemanticFunctionImplementationParams {
  model: Model;
  argsMappingTemplate?: string;
  returnMappingTemplate?: string;
  isDefault: boolean;
  promptEnrichmentPipeline?: PromptEnrichmentPipeline;
  inputGuardrails?: InputGuardrails;
  outputProcessingPipeline?: OutputProcessingPipeline;
  dataMapper?: DataMapper;
  callbacks?: Callback[];
}
