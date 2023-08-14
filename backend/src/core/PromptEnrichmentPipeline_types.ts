import { Callback } from './Callback';
import { ModelParams } from './Model_types';
import { Message } from './PromptTemplate_types';
import { PromptTemplate } from './PromptTemplate';
import { SemanticFunction } from './SemanticFunction';
// import { Tracer, Trace } from './Tracer';

export interface PromptEnrichmentCallParams {
  args: any;
  callbacks?: Callback[];
}

export interface PromptEnrichmentStep {
  call: (args: any) => Promise<object>;
  // tracer?: Tracer;
  callbacks?: Callback[];
}

export interface PromptEnrichmentOnEndParams {
  messages?: Message[];
  errors?: any;
}

export interface PromptEnrichmentOnStartResponse {
  args: any;
  // trace: Trace;
}

export interface PromptEnrichmentOnEndResponse {
  messages?: Message[];
  errors?: any;
  // trace: Trace;
}

export type PromptEnrichmentOnStartCallbackFunction = (params: PromptEnrichmentOnStartResponse) => void;

export type PromptEnrichmentOnEndCallbackFunction = (params: PromptEnrichmentOnEndResponse) => void;

export type PromptEnrichmentOnErrorCallbackFunction = (errors: any) => void;

export interface PromptEnrichmentPipelineParams {
  promptTemplate: PromptTemplate;
  steps: PromptEnrichmentStep[];
  callbacks?: Callback[];
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
  enrichedArgs?: any;
  errors?: any;
}

export interface FeatureStoreEnrichmentOnStartResponse {
  featureStore: FeatureStore;
  args: any;
  // trace: Trace;
}

export interface FeatureStoreEnrichmentOnEndResponse {
  featureStore: FeatureStore;
  enrichedArgs?: any;
  errors?: any;
  // trace: Trace;
}

export type FeatureStoreEnrichmentOnStartCallbackFunction = (params: FeatureStoreEnrichmentOnStartResponse) => void;

export type FeatureStoreEnrichmentOnEndCallbackFunction = (params: FeatureStoreEnrichmentOnEndResponse) => void;

export type FeatureStoreEnrichmentOnErrorCallbackFunction = (errors: any) => void;

export interface FeatureStoreEnrichmentParams {
  featureStoreService: any;
  featurestore: string;
  featureStoreParams: FeatureStoreParams;
  callbacks?: Callback[];
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
  enrichedArgs?: any;
  errors?: any;
}

export interface SemanticSearchEnrichmentOnStartResponse {
  index: Index;
  args: any;
  // trace: Trace;
}

export interface SemanticSearchEnrichmentOnEndResponse {
  index: Index;
  enrichedArgs?: any;
  errors?: any;
  // trace: Trace;
}

export type SemanticSearchEnrichmentOnStartCallbackFunction = (params: SemanticSearchEnrichmentOnStartResponse) => void;

export type SemanticSearchEnrichmentOnEndCallbackFunction = (params: SemanticSearchEnrichmentOnEndResponse) => void;

export type SemanticSearchEnrichmentOnErrorCallbackFunction = (errors: any) => void;

export interface SearchIndexEnrichmentParams {
  indexName: string;
  indexParams: IndexParams;
  searchService: any;
  callbacks?: Callback[];
}

export interface OnFunctionEnrichmentEndParams {
  enrichedArgs?: any;
  errors?: any;
}

export interface FunctionEnrichmentOnStartResponse {
  functionName: string;
  modelKey: string;
  modelParams: ModelParams;
  contentPropertyPath: string;
  contextPropertyPath: string;
  args: any;
  // trace: Trace;
}

export interface FunctionEnrichmentOnEndResponse {
  functionName: string;
  modelKey: string;
  modelParams: ModelParams;
  contentPropertyPath: string;
  contextPropertyPath: string;
  enrichedArgs?: any;
  errors?: any;
  // trace: Trace;
}

export type FunctionEnrichmentOnStartCallbackFunction = (params: FunctionEnrichmentOnStartResponse) => void;

export type FunctionEnrichmentOnEndCallbackFunction = (params: FunctionEnrichmentOnEndResponse) => void;

export type FunctionEnrichmentOnErrorCallbackFunction = (errors: any) => void;

export interface FunctionEnrichmentParams {
  semanticFunction: SemanticFunction;
  modelKey: string;
  modelParams: ModelParams;
  contentPropertyPath: string;
  contextPropertyPath: string;
  callbacks?: Callback[];
}

export interface OnSqlEnrichmentEndParams {
  enrichedArgs?: any;
  errors?: any;
}

export interface SqlEnrichmentOnStartResponse {
  // sqlSourceInfo: any;
  args: any;
  // trace: Trace;
}

export interface SqlEnrichmentOnEndResponse {
  // sqlSourceInfo: any;
  enrichedArgs?: any;
  errors?: any;
  // trace: Trace;
}

export type SqlEnrichmentOnStartCallbackFunction = (params: SqlEnrichmentOnStartResponse) => void;

export type SqlEnrichmentOnEndCallbackFunction = (params: SqlEnrichmentOnEndResponse) => void;

export type SqlEnrichmentOnErrorCallbackFunction = (errors: any) => void;

export interface SqlEnrichmentParams {
  sqlSourceInfo: any;
  sqlSourceService: any;
  callbacks?: Callback[];
}