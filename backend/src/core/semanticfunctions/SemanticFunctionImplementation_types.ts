import { DataMapper, Model } from '../common_types';
import { Callback } from '../callbacks/Callback';
import { InputGuardrails } from '../guardrails/InputGuardrails';
import { OutputProcessingPipeline } from '../outputprocessing/OutputProcessingPipeline';
import { PromptEnrichmentPipeline } from '../promptenrichment/PromptEnrichmentPipeline';
import { ChatResponse, Function, Message, ModelObject, ModelParams } from '../conversions/RosettaStone';
import { SemanticFunction } from './SemanticFunction';

export interface SemanticFunctionImplementationCallParams {
  args: any;
  messages?: Message[];
  history?: Message[];
  extraSystemPrompt?: string;
  model?: ModelObject;
  modelParams: Partial<ModelParams>;
  functions?: Function[];
  isBatch?: boolean;
  returnTypeSchema?: object;
  options: any;
  callbacks?: Callback[];
}

export interface SemanticFunctionImplementationOnStartResponse extends SemanticFunctionImplementationCallParams {
  modelType: string;
}

export interface SemanticFunctionImplementationOnEndParams {
  model: ModelObject;
  response?: ChatResponse;
  errors?: any;
}

export interface SemanticFunctionImplementationOnEndResponse extends SemanticFunctionImplementationOnEndParams {
  model: ModelObject;
  response?: ChatResponse;
  errors?: any;
}

export type SemanticFunctionImplementationOnStartCallbackFunction = (params: SemanticFunctionImplementationOnStartResponse) => void;

export type SemanticFunctionImplementationOnEndCallbackFunction = (params: SemanticFunctionImplementationOnEndResponse) => void;

export type SemanticFunctionImplementationOnErrorCallbackFunction = (errors: any) => void;

export interface SemanticFunctionImplementationParams {
  model: Model;
  isDefault: boolean;
  argsMappingTemplate?: string;
  returnMappingTemplate?: string;
  indexContentPropertyPath?: string;
  indexContextPropertyPath?: string;
  rewriteQuery?: boolean;
  summarizeResults?: boolean;
  promptEnrichmentPipeline?: PromptEnrichmentPipeline;
  inputGuardrails?: InputGuardrails;
  outputProcessingPipeline?: OutputProcessingPipeline;
  queryRewriteFunction?: SemanticFunction;
  dataMapper?: DataMapper;
  callbacks?: Callback[];
}
