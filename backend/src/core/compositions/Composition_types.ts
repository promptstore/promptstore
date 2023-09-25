import { DataMapper } from '../common_types';
import { Callback } from '../callbacks/Callback';
import { ModelParams } from '../conversions/RosettaStone';
import { SemanticFunction } from '../semanticfunctions/SemanticFunction';

interface INode {
  id: string;
  type: string;
}

export interface IRequestNode extends INode {
  argsSchema: object;  // JSONSchema
}

export interface IFunctionNode extends INode {
  func: SemanticFunction;
}

export interface IMapperNode extends INode {
  mappingTemplate: string;
}

export interface IJoinerNode extends INode {

}

export interface IOutputNode extends INode {

}

export type Node = IRequestNode | IFunctionNode | IMapperNode | IJoinerNode | IOutputNode;

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
  modelKey: string;
  modelParams: ModelParams;
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
  callbacks?: Callback[];
}
