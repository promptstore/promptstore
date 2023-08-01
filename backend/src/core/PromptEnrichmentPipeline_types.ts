import { ModelParams } from './Model_types';
import { Message } from './PromptTemplate_types';
import { PromptTemplate } from './PromptTemplate';
import { SemanticFunction } from './SemanticFunction';
import { Trace } from './Tracer';

export interface PromptEnrichmentCallParams {
  args: any;
}

export interface PromptEnrichmentStep {
  call: (args: any) => Promise<object>;
}

export interface OnPromptEnrichmentEndParams {
  messages: Message[];
}

interface OnPromptEnrichmentStartResponse {
  args: any;
  trace: Trace;
}

interface OnPromptEnrichmentEndResponse {
  messages: Message[];
  trace: Trace;
}

export type OnPromptEnrichmentStartCallbackFunction = (params: OnPromptEnrichmentStartResponse) => void;

export type OnPromptEnrichmentEndCallbackFunction = (params: OnPromptEnrichmentEndResponse) => void;

export type OnPromptEnrichmentErrorCallbackFunction = (errors: any) => void;

export interface PromptEnrichmentPipelineParams {
  promptTemplate: PromptTemplate;
  steps: PromptEnrichmentStep[];
  onPromptEnrichmentStart?: OnPromptEnrichmentStartCallbackFunction;
  onPromptEnrichmentEnd?: OnPromptEnrichmentEndCallbackFunction;
  onPromptEnrichmentError?: OnPromptEnrichmentErrorCallbackFunction;
}

export interface FeatureStoreParams {
  appId: string;
  appSecret: string;
  entity: string;
  featureList: string[];
  featureService: string;
  featureStoreName: string;
  httpMethod: string;
  url: string;
}

interface FeatureStore {
  name: string;
  params: FeatureStoreParams;
}

export interface OnFeatureStoreEnrichmentEndParams {
  args: any;
}

interface OnFeatureStoreEnrichmentStartResponse {
  featureStore: FeatureStore;
  args: any;
  trace: Trace;
}

interface OnFeatureStoreEnrichmentEndResponse {
  featureStore: FeatureStore;
  args: any;
  trace: Trace;
}

export type OnFeatureStoreEnrichmentStartCallbackFunction = (params: OnFeatureStoreEnrichmentStartResponse) => void;

export type OnFeatureStoreEnrichmentEndCallbackFunction = (params: OnFeatureStoreEnrichmentEndResponse) => void;

export type OnFeatureStoreEnrichmentErrorCallbackFunction = (errors: any) => void;

export interface FeatureStoreEnrichmentParams {
  featureStoreService: any;
  featurestore: string;
  featureStoreParams: FeatureStoreParams;
  onFeatureStoreEnrichmentStart?: OnFeatureStoreEnrichmentStartCallbackFunction;
  onFeatureStoreEnrichmentEnd?: OnFeatureStoreEnrichmentEndCallbackFunction;
  onFeatureStoreEnrichmentError?: OnFeatureStoreEnrichmentErrorCallbackFunction;
}

export interface IndexParams {
  indexContentPropertyPath: string;
  indexContextPropertyPath: string;
  allResults: boolean;
}

interface Index {
  name: string;
  params: IndexParams;
}

export interface OnSemanticSearchEnrichmentEndParams {
  args: any;
}

interface OnSemanticSearchEnrichmentStartResponse {
  index: Index;
  args: any;
  trace: Trace;
}

interface OnSemanticSearchEnrichmentEndResponse {
  index: Index;
  args: any;
  trace: Trace;
}

export type OnSemanticSearchEnrichmentStartCallbackFunction = (params: OnSemanticSearchEnrichmentStartResponse) => void;

export type OnSemanticSearchEnrichmentEndCallbackFunction = (params: OnSemanticSearchEnrichmentEndResponse) => void;

export type OnSemanticSearchEnrichmentErrorCallbackFunction = (errors: any) => void;

export interface SearchIndexEnrichmentParams {
  indexName: string;
  indexParams: IndexParams;
  searchService: any;
  onSemanticSearchEnrichmentStart?: OnSemanticSearchEnrichmentStartCallbackFunction;
  onSemanticSearchEnrichmentEnd?: OnSemanticSearchEnrichmentEndCallbackFunction;
  onSemanticSearchEnrichmentError?: OnSemanticSearchEnrichmentErrorCallbackFunction;
}

export interface OnFunctionEnrichmentEndParams {
  args: any;
}

interface OnFunctionEnrichmentStartResponse {
  functionName: string;
  modelKey: string;
  modelParams: ModelParams;
  contentPropertyPath: string;
  contextPropertyPath: string;
  args: any;
  trace: Trace;
}

interface OnFunctionEnrichmentEndResponse {
  functionName: string;
  modelKey: string;
  modelParams: ModelParams;
  contentPropertyPath: string;
  contextPropertyPath: string;
  args: any;
  trace: Trace;
}

export type OnFunctionEnrichmentStartCallbackFunction = (params: OnFunctionEnrichmentStartResponse) => void;

export type OnFunctionEnrichmentEndCallbackFunction = (params: OnFunctionEnrichmentEndResponse) => void;

export type OnFunctionEnrichmentErrorCallbackFunction = (errors: any) => void;

export interface FunctionEnrichmentParams {
  semanticFunction: SemanticFunction;
  modelKey: string;
  modelParams: ModelParams;
  contentPropertyPath: string;
  contextPropertyPath: string;
  onFunctionEnrichmentStart?: OnFunctionEnrichmentStartCallbackFunction;
  onFunctionEnrichmentEnd?: OnFunctionEnrichmentEndCallbackFunction;
  onFunctionEnrichmentError?: OnFunctionEnrichmentErrorCallbackFunction;
}
