import { Callback } from '../callbacks/Callback';
import { GraphStoreService } from '../indexers/GraphStore';
import { PromptTemplate } from './PromptTemplate';
import { Message, ModelParams } from '../conversions/RosettaStone';
import { SemanticFunction } from '../semanticfunctions/SemanticFunction';

export interface PromptEnrichmentCallParams {
  args: any;
  contextWindow?: number;
  maxTokens?: number;
  modelKey?: string;
  callbacks?: Callback[];
}

export interface PromptEnrichmentStep {
  call: (args: any) => Promise<object>;
  callbacks?: Callback[];
}

export interface PromptEnrichmentOnEndParams {
  messages?: Message[];
  errors?: any;
}

export interface PromptEnrichmentOnStartResponse {
  args: any;
}

export interface PromptEnrichmentOnEndResponse {
  messages?: Message[];
  errors?: any;
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
}

export interface FeatureStoreEnrichmentOnEndResponse {
  featureStore: FeatureStore;
  enrichedArgs?: any;
  errors?: any;
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
  nodeLabel: string;
  indexContentPropertyPath: string;
  indexContextPropertyPath: string;
  allResults: boolean;
  embeddingProvider?: string,
  vectorStoreProvider?: string,
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
}

export interface SemanticSearchEnrichmentOnEndResponse {
  index: Index;
  enrichedArgs?: any;
  errors?: any;
}

export type SemanticSearchEnrichmentOnStartCallbackFunction = (params: SemanticSearchEnrichmentOnStartResponse) => void;

export type SemanticSearchEnrichmentOnEndCallbackFunction = (params: SemanticSearchEnrichmentOnEndResponse) => void;

export type SemanticSearchEnrichmentOnErrorCallbackFunction = (errors: any) => void;

export interface SearchIndexEnrichmentParams {
  indexName: string;
  indexParams: IndexParams;
  embeddingService: any;
  vectorStoreService: any;
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
}

export interface FunctionEnrichmentOnEndResponse {
  functionName: string;
  modelKey: string;
  modelParams: ModelParams;
  contentPropertyPath: string;
  contextPropertyPath: string;
  enrichedArgs?: any;
  errors?: any;
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
  args: any;
}

export interface SqlEnrichmentOnEndResponse {
  enrichedArgs?: any;
  errors?: any;
}

export type SqlEnrichmentOnStartCallbackFunction = (params: SqlEnrichmentOnStartResponse) => void;

export type SqlEnrichmentOnEndCallbackFunction = (params: SqlEnrichmentOnEndResponse) => void;

export type SqlEnrichmentOnErrorCallbackFunction = (errors: any) => void;

export interface SqlEnrichmentParams {
  sqlSourceInfo: any;
  sqlSourceService: any;
  callbacks?: Callback[];
}

export interface OnGraphEnrichmentEndParams {
  enrichedArgs?: any;
  errors?: any;
}

export interface GraphEnrichmentOnStartResponse {
  args: any;
}

export interface GraphEnrichmentOnEndResponse {
  enrichedArgs?: any;
  errors?: any;
}

export type GraphEnrichmentOnStartCallbackFunction = (params: GraphEnrichmentOnStartResponse) => void;

export type GraphEnrichmentOnEndCallbackFunction = (params: GraphEnrichmentOnEndResponse) => void;

export type GraphEnrichmentOnErrorCallbackFunction = (errors: any) => void;

export interface GraphEnrichmentParams {
  graphSourceInfo: any;
  graphStoreService: GraphStoreService;
  callbacks?: Callback[];
}
