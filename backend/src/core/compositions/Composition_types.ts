import type { Schema } from 'jsonschema';

import { Tool } from '../../agents/Agent_types';
import { DataMapper } from '../common_types';
import { Callback } from '../callbacks/Callback';
import { Function, ModelObject, ModelParams } from '../conversions/RosettaStone';
import { SemanticFunction } from '../semanticfunctions/SemanticFunction';

export interface INode {
  id: string;
  type: string;
}

export interface IRequestNode extends INode {
  argsSchema: Schema;
}

export interface IFunctionNode extends INode {
  func: SemanticFunction;
}

export interface IToolNode extends INode {
  tool: Tool;
  raw: boolean;
}

export interface IMapperNode extends INode {
  mappingTemplate: string;
}

export interface IJoinerNode extends INode {

}

export interface ILoaderNode extends INode {
  loader: string;
}

export interface ILoopNode extends INode {
  loopVar: string;
  aggregationVar: string;
}

export interface IOutputNode extends INode {

}

export interface IDataSourceNode extends INode {
  dataSource: any;
}

export interface IIndexNode extends INode {
  index: any;
}

export interface IScheduleNode extends INode {
  schedule: any;
}

export interface ILoaderNode extends INode {
  loader: string;
  endpoint?: string;
  schema?: Schema;
  baseUrl?: string;
  maxRequestsPerCrawl?: number;
  chunkElement?: string;
  scrapingSpec?: Schema;
  bucket?: string;
  prefix?: string;
  recursive?: boolean;
  query?: string;
  spaceKey?: string;
}

export interface IExtractorNode extends INode {
  extractor: string;
  delimiter?: string;
  quoteChar?: string;
  nodeLabel?: string;
  embeddingNodeProperty?: string;
  textNodeProperties?: string[];
  limit?: number;
  splitter?: string;
  characters?: string;
  functionId?: string;
  chunkSize?: number;
  chunkOverlap?: number;
  rephraseFunctionIds?: string[];
}

export interface IVectorStoreNode extends INode {
  vectorStoreProvider: string;
  newIndexName: string;
}

export interface EmbeddingModel {
  provider: string;
  model: string;
}

export interface IEmbeddingNode extends INode {
  embeddingModel: EmbeddingModel;
}

export interface IGraphStoreNode extends INode {
  graphStoreProvider: string;
}

export type Node = IRequestNode | IFunctionNode | IMapperNode | IJoinerNode | IOutputNode | IDataSourceNode | IIndexNode | IScheduleNode | ILoaderNode | IExtractorNode | IVectorStoreNode | IEmbeddingNode | IGraphStoreNode;

export interface IEdge {
  id: string;
  source: string;
  target: string;
}

export interface CompositionOnEndParams {
  response?: any;
  errors?: any;
}

export interface CompositionOnEndResponse extends CompositionOnEndParams {
  name: string;
  response?: any;
  errors?: any;
}

export interface CompositionCallParams {
  args: any;
  model: ModelObject;
  modelParams: Partial<ModelParams>;
  functions?: Function[];
  isBatch?: boolean;
  callbacks?: Callback[];
}

export interface CompositionOnStartResponse extends CompositionCallParams {
  name: string;
}

export type CompositionOnStartCallbackFunction = (params: CompositionOnStartResponse) => void;

export type CompositionOnEndCallbackFunction = (params: CompositionOnEndResponse) => void;

export type CompositionOnErrorCallbackFunction = (errors: any) => void;

export interface CompositionParams {
  name: string;
  edges: IEdge[];
  nodes: Node[];
  dataMapper?: DataMapper;
  pipelinesService: any;
  callbacks?: Callback[];
}
