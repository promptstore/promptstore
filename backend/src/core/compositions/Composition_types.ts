import type { Schema } from 'jsonschema';

import { Tool } from '../../agents/Agent_types';
import { AgentRuntime } from '../../agents/AgentRuntime';
import { DataMapper } from '../common_types';
import { Callback } from '../callbacks/Callback';
import { Function, ModelObject, ModelParams } from '../conversions/RosettaStone';
import { SemanticFunction } from '../semanticfunctions/SemanticFunction';

export interface EmbeddingModel {
  provider: string;
  model: string;
}

export interface INode {
  id: string;
  type: string;
}

export interface IToolCapable extends INode {
  name: string;
}

export interface IAgentNode extends IToolCapable {
  agent: AgentRuntime;
}

export interface IDataSourceNode extends INode {
  dataSource: any;
}

export interface IEmbeddingNode extends INode {
  embeddingModel: EmbeddingModel;
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

export interface IFunctionNode extends IToolCapable {
  func: SemanticFunction;
  functions: Function[];
}

export interface IFunctionRouterNode extends INode {
  functions: Function[];

  addFunction: (func: Function) => void;
}

export interface IGraphStoreNode extends INode {
  graphStoreProvider: string;
}

export interface IIndexNode extends INode {
  index: any;
}

export interface IJoinerNode extends INode {

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

export interface ILoopNode extends INode {
  loopVar: string;
  aggregationVar: string;
}

export interface IMapperNode extends INode {
  mappingTemplate: string;
}

export interface IOutputNode extends INode {

}

export interface IRequestNode extends INode {
  argsSchema: Schema;
}

export interface IScheduleNode extends INode {
  schedule: any;
}

export interface IToolNode extends IToolCapable {
  tool: Tool;
  raw: boolean;
}

export interface ITransformerNode extends INode {
  functionId: number;
}

export interface IVectorStoreNode extends INode {
  vectorStoreProvider: string;
  newIndexName: string;
}

export type Node = IRequestNode | IFunctionNode | IMapperNode | IJoinerNode | IOutputNode | IDataSourceNode | IIndexNode | IScheduleNode | ILoaderNode | IExtractorNode | IVectorStoreNode | IEmbeddingNode | IGraphStoreNode;

export interface IEdge {
  id: string;
  source: string;
  sourceHandle: string;
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
  workspaceId: number;
  username: string;
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
