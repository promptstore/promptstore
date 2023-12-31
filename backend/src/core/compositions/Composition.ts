import { default as dayjs } from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import merge from 'lodash.merge';
import { mapJsonAsync } from 'jsonpath-mapper';

import logger from '../../logger';

import { Tool } from '../../agents/Agent_types';
import { DataMapper, Source } from '../common_types';
import { CompositionError } from '../errors';
import { Callback } from '../callbacks/Callback';
import {
  CompositionCallParams,
  CompositionOnEndParams,
  CompositionParams,
  INode,
  IEdge,
  IRequestNode,
  IFunctionNode,
  IToolNode,
  IMapperNode,
  IJoinerNode,
  IOutputNode,
  Node,
} from './Composition_types';
import { SemanticFunction } from '../semanticfunctions/SemanticFunction';

dayjs.extend(relativeTime);

export class Composition {

  name: string;
  nodes: Node[];
  edges: IEdge[];
  dataMapper: DataMapper;
  callbacks: Callback[];
  currentCallbacks: Callback[];

  constructor({
    name,
    nodes,
    edges,
    dataMapper,
    callbacks,
  }: CompositionParams) {
    this.name = name;
    this.nodes = nodes;
    this.edges = edges;
    this.dataMapper = dataMapper || mapJsonAsync;
    this.callbacks = callbacks || [];
  }

  async call({ args, modelKey, modelParams, isBatch, callbacks = [] }: CompositionCallParams) {
    this.currentCallbacks = [...this.callbacks, ...callbacks];
    this.onStart({ args, modelKey, modelParams, isBatch });

    const inner = async (node: Node) => {
      if (node.type === 'requestNode') {
        return args;
      }
      const sourceIds = this.edges.filter(e => e.target === node.id).map(e => e.source);
      let res = {};
      for (let sourceId of sourceIds) {
        let sourceNode = this.nodes.find(n => n.id === sourceId);
        if (!sourceNode) {
          throw new CompositionError(`Source node (${sourceId}) not found.`);
        }
        let myargs = await inner(sourceNode);
        logger.debug(node.type, 'myargs:', myargs);
        if (node.type === 'functionNode') {
          let functionNode = node as IFunctionNode;
          let func = functionNode.func;
          let { response } = await func.call({
            args: myargs,
            modelKey,
            modelParams,
          });
          const message = response.choices[0].message;
          logger.debug(node.type, 'message:', message);
          if (func.returnType === 'application/json') {
            let json: any;
            try {
              if (func.returnTypeSchema && message.function_call) {
                json = JSON.parse(message.function_call.arguments);
              } else {
                json = JSON.parse(message.content);
              }
            } catch (err) {
              logger.error('error parsing json response:', err);
              json = {};
            }
            logger.debug(node.type, 'previous result:', res);
            logger.debug(node.type, 'json:', json);
            res = merge(res, json);
          } else {
            res = merge(res, { content: message.content });
          }
        } else if (node.type === 'compositionNode') {
          let compositionNode = node as ICompositionNode;
          let composition = compositionNode.composition;
          let { response } = await composition.call({
            args: myargs,
            modelKey,
            modelParams,
          });
          res = merge(res, response);
        } else if (node.type === 'toolNode') {
          let toolNode = node as IToolNode;
          let tool = toolNode.tool;
          let response = await tool.call(myargs, true);
          res = merge(res, { response });
        } else if (node.type === 'mapperNode') {
          let mapperNode = node as IMapperNode;
          let mappingTemplate = mapperNode.mappingTemplate;
          let source: Source = {
            type: sourceNode.type.slice(0, -4),
          };
          if (sourceNode.type === 'functionNode') {
            source.name = (sourceNode as IFunctionNode).func.name;
          }
          let response = await this.mapArgs(source, myargs, mappingTemplate, isBatch);
          res = merge(res, response);
        } else {
          res = merge(res, myargs);
        }
        logger.debug(node.type, 'res:', res);
      }
      return res;
    }

    try {
      const output = this.nodes.find(n => n.type === 'outputNode');
      if (!output) {
        throw new CompositionError('No output node found');
      }

      const response = await inner(output);
      this.onEnd({ response });
      return { response };

    } catch (err) {
      const errors = err.errors || [{ message: String(err) }];
      this.onEnd({ errors });
      throw err;
    }
  }

  async mapArgs(source: Source, args: any, mappingTemplate: any, isBatch: boolean) {
    try {
      const mapped = await this._mapArgs(args, mappingTemplate, isBatch);
      for (let callback of this.currentCallbacks) {
        callback.onMapArguments({
          source,
          args,
          mapped,
          mappingTemplate,
          isBatch,
        });
      }
      return mapped;
    } catch (err) {
      for (let callback of this.currentCallbacks) {
        callback.onMapArguments({
          source,
          args,
          mappingTemplate,
          isBatch,
          errors: [{ message: String(err) }],
        });
      }
    }
  }

  _mapArgs(args: any, mappingTemplate: any, isBatch: boolean): Promise<any> {
    const template = eval(`(${mappingTemplate})`);
    const mapData = (instance: object) => this.dataMapper(instance, template);
    if (isBatch) {
      return Promise.all(args.map(mapData));
    }
    return mapData(args);
  }

  onStart({ args, modelKey, modelParams, isBatch }: CompositionCallParams) {
    for (let callback of this.currentCallbacks) {
      callback.onCompositionStart({
        name: this.name,
        args,
        modelKey,
        modelParams,
        isBatch,
      });
    }
  }

  onEnd({ response, errors }: CompositionOnEndParams) {
    for (let callback of this.currentCallbacks) {
      callback.onCompositionEnd({
        name: this.name,
        response,
        errors,
      });
    }
  }

  throwCompositionError(message: string) {
    const errors = [{ message }];
    for (let callback of this.currentCallbacks) {
      callback.onCompositionError(errors);
    }
    throw new CompositionError(message);
  }

}

export interface ICompositionNode extends INode {
  composition: Composition;
}

export const composition = (name: string, nodes: Node[], edges: IEdge[], callbacks: Callback[]) => {
  return new Composition({
    name,
    nodes,
    edges,
    callbacks
  });
}

class RequestNode implements IRequestNode {

  id: string;
  type: string;
  argsSchema: object;

  constructor(id: string, argsSchema: object) {
    this.id = id;
    this.type = 'requestNode';
    this.argsSchema = argsSchema;
  }

}

class FunctionNode implements IFunctionNode {

  id: string;
  type: string;
  func: SemanticFunction;

  constructor(id: string, func: SemanticFunction) {
    this.id = id;
    this.type = 'functionNode';
    this.func = func;
  }

}

class CompositionNode implements ICompositionNode {

  id: string;
  type: string;
  composition: Composition;

  constructor(id: string, composition: Composition) {
    this.id = id;
    this.type = 'compositionNode';
    this.composition = composition;
  }

}

class ToolNode implements IToolNode {

  id: string;
  type: string;
  tool: Tool;

  constructor(id: string, tool: Tool) {
    this.id = id;
    this.type = 'toolNode';
    this.tool = tool;
  }

}

class MapperNode implements IMapperNode {

  id: string;
  type: string;
  mappingTemplate: string;

  constructor(id: string, mappingTemplate: string) {
    this.id = id;
    this.type = 'mapperNode';
    this.mappingTemplate = mappingTemplate;
  }

}

class JoinerNode implements IJoinerNode {

  id: string;
  type: string;

  constructor(id: string) {
    this.id = id;
    this.type = 'joinerNode';
  }

}

class OutputNode implements IOutputNode {

  id: string;
  type: string;

  constructor(id: string) {
    this.id = id;
    this.type = 'outputNode';
  }

}

class Edge implements IEdge {

  id: string;
  source: string;
  target: string;

  constructor(id: string, source: string, target: string) {
    this.id = id;
    this.source = source;
    this.target = target;
  }

}

export const requestNode = (id: string, argsSchema: object) => {
  return new RequestNode(id, argsSchema);
};

export const functionNode = (id: string, func: SemanticFunction) => {
  return new FunctionNode(id, func);
};

export const compositionNode = (id: string, composition: Composition) => {
  return new CompositionNode(id, composition);
};

export const toolNode = (id: string, tool: Tool) => {
  return new ToolNode(id, tool);
};

export const mapperNode = (id: string, mappingTemplate: string) => {
  return new MapperNode(id, mappingTemplate);
}

export const joinerNode = (id: string) => {
  return new JoinerNode(id);
};

export const outputNode = (id: string) => {
  return new OutputNode(id);
};

export const edge = (id: string, source: string, target: string) => {
  return new Edge(id, source, target);
};
