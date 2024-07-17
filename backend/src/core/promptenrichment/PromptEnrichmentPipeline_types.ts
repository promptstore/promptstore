import { Callback } from '../callbacks/Callback';
import { GraphStoreService } from '../indexers/GraphStore';
import { PromptTemplate } from './PromptTemplate';
import { Message, ModelObject, ModelParams, ResponseMetadata } from '../conversions/RosettaStone';
import { LLMModel, LLMService } from '../models/llm_types';
import { SemanticFunction } from '../semanticfunctions/SemanticFunction';

export interface PromptEnrichmentCallParams {
  args: any;
  isBatch: boolean;
  messages?: Message[];
  contextWindow?: number;
  maxOutputTokens?: number;
  maxTokens?: number;
  model?: string;
  callbacks?: Callback[];
}

export interface EnrichmentPipelineResponse {
  messages: Message[];
  responseMetadata?: Partial<ResponseMetadata>;
}

export interface EnrichmentStepResponse {
  args: any;
  responseMetadata?: Partial<ResponseMetadata>;
}

export interface PromptEnrichmentStep {
  call: (args: any) => Promise<EnrichmentStepResponse>;
  callbacks?: Callback[];
}

export interface PromptEnrichmentOnEndParams {
  messages?: Message[];
  errors?: any;
}

export interface PromptEnrichmentOnStartResponse {
  args: any;
  isBatch: boolean;
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
  isBatch: boolean;
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

export interface MetricStoreParams {
  environmentId: string;
  httpMethod: string;
  url: string;
}

interface MetricStore {
  name: string;
  params: MetricStoreParams;
}

export interface OnMetricStoreEnrichmentEndParams {
  enrichedArgs?: any;
  errors?: any;
}

export interface MetricStoreEnrichmentOnStartResponse {
  metricStore: MetricStore;
  args: any;
  isBatch: boolean;
}

export interface MetricStoreEnrichmentOnEndResponse {
  metricStore: MetricStore;
  enrichedArgs?: any;
  errors?: any;
}

export type MetricStoreEnrichmentOnStartCallbackFunction = (params: MetricStoreEnrichmentOnStartResponse) => void;

export type MetricStoreEnrichmentOnEndCallbackFunction = (params: MetricStoreEnrichmentOnEndResponse) => void;

export type MetricStoreEnrichmentOnErrorCallbackFunction = (errors: any) => void;

export interface MetricStoreEnrichmentParams {
  metricStoreService: any;
  metricstore: string;
  metricStoreParams: MetricStoreParams;
  callbacks?: Callback[];
}

export interface IndexParams {
  nodeLabel: string;
  indexContentPropertyPath: string;
  indexContextPropertyPath: string;
  allResults: boolean;
  embeddingModel?: Partial<LLMModel>,
  vectorStoreProvider?: string,
}

interface Index {
  id: number;
  name: string;
  params: IndexParams;
}

interface SemanticSearchHit {
  id: string;
  score?: number;
  dist?: number;
}

export interface SemanticSearchHits {
  dataSourceId: number;
  dataSourceName: string;
  hits: SemanticSearchHit[];
}

export interface OnSemanticSearchEnrichmentEndParams {
  enrichedArgs?: any;
  sources?: Map<number, SemanticSearchHits>;
  errors?: any;
}

export interface SemanticSearchEnrichmentOnStartResponse {
  index: Index;
  args: any;
  isBatch: boolean;
}

export interface SemanticSearchEnrichmentOnEndResponse {
  enrichedArgs?: any;
  sources?: Map<number, SemanticSearchHits>;
  errors?: any;
}

export type SemanticSearchEnrichmentOnStartCallbackFunction = (params: SemanticSearchEnrichmentOnStartResponse) => void;

export type SemanticSearchEnrichmentOnEndCallbackFunction = (params: SemanticSearchEnrichmentOnEndResponse) => void;

export type SemanticSearchEnrichmentOnErrorCallbackFunction = (errors: any) => void;

export interface SearchIndexEnrichmentParams {
  indexId: number;
  indexName: string;
  indexParams: IndexParams;
  llmService: LLMService;
  vectorStoreService: any;
  rerankerModel: any;
  callbacks?: Callback[];
}

export interface OnFunctionEnrichmentEndParams {
  enrichedArgs?: any;
  errors?: any;
}

export interface FunctionEnrichmentOnStartResponse {
  functionName: string;
  model: ModelObject;
  modelParams: Partial<ModelParams>;
  contentPropertyPath: string;
  contextPropertyPath: string;
  args: any;
  isBatch: boolean;
}

export interface FunctionEnrichmentOnEndResponse {
  functionName: string;
  model: ModelObject;
  modelParams: Partial<ModelParams>;
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
  model: ModelObject;
  modelParams: Partial<ModelParams>;
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
  isBatch: boolean;
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
  isBatch: boolean;
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

export interface Snippet {
  id: string;
  key: string;
  content: string;
  created: string;
  createdBy: string;
  modified?: string;
  modifiedBy?: string;
}