import { default as dayjs } from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import merge from 'lodash.merge';
import { mapJsonAsync } from 'jsonpath-mapper';

import logger from '../../logger';

import { Tool } from '../../agents/Agent_types';
import { DataMapper, Source } from '../common_types';
import { CompositionError } from '../errors';
import { Callback } from '../callbacks/Callback';
import { DataSource } from '../indexers/DataSource';
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
  IDataSourceNode,
  IIndexNode,
  IScheduleNode,
  Node,
} from './Composition_types';
import { SemanticFunction } from '../semanticfunctions/SemanticFunction';

dayjs.extend(relativeTime);

export class Composition {

  name: string;
  nodes: Node[];
  edges: IEdge[];
  dataMapper: DataMapper;
  pipelinesService: any;
  callbacks: Callback[];
  currentCallbacks: Callback[];

  constructor({
    name,
    nodes,
    edges,
    dataMapper,
    pipelinesService,
    callbacks,
  }: CompositionParams) {
    this.name = name;
    this.nodes = nodes;
    this.edges = edges;
    this.dataMapper = dataMapper || mapJsonAsync;
    this.pipelinesService = pipelinesService;
    this.callbacks = callbacks || [];
  }

  async call({ args, model, modelParams, isBatch, callbacks = [] }: CompositionCallParams) {
    this.currentCallbacks = [...this.callbacks, ...callbacks];
    this.onStart({ args, model, modelParams, isBatch });
    let dataSource: any;
    let index: any;

    const inner = async (node: Node) => {
      if (node.type === 'requestNode' || node.type === 'scheduleNode') {
        return args;
      }
      const sourceIds = this.edges.filter(e => e.target === node.id).map(e => e.source);
      let res = {};
      for (let sourceId of sourceIds) {
        let sourceNode = this.nodes.find(n => n.id === sourceId);
        if (!sourceNode) {
          logger.debug('nodes:', this.nodes);
          throw new CompositionError(`Source node (${sourceId}) not found.`);
        }
        let myargs = await inner(sourceNode);
        // logger.debug(node.type, 'myargs:', myargs);
        if (node.type === 'functionNode') {
          let functionNode = node as IFunctionNode;
          let func = functionNode.func;
          let response = await func.call({
            args: myargs,
            model,
            modelParams,
          });
          logger.debug('response:', response);
          const message = response.response.choices[0].message;
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
            model,
            modelParams,
          });
          res = merge(res, response);
        } else if (node.type === 'toolNode') {
          let toolNode = node as IToolNode;
          let tool = toolNode.tool;
          let response = await tool.call(myargs, true);
          res = merge(res, response);
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
        } else if (node.type === 'sourceNode') {
          let dataSourceNode = node as IDataSourceNode;
          dataSource = dataSourceNode.dataSource;
        } else if (node.type === 'indexNode') {
          let indexNode = node as IIndexNode;
          index = indexNode.index;
        } else {
          res = merge(res, myargs);
        }
        // logger.debug(node.type, 'res:', res);
      }
      return res;
    }

    try {
      const output = this.nodes.find(n => n.type === 'outputNode');
      if (!output) {
        throw new CompositionError('No output node found');
      }

      const response = await inner(output);

      if (dataSource && index) {
        // create and run pipeline
        const params = {
          dataSourceId: dataSource.id,
          dataSourceName: dataSource.name,
          documents: dataSource.documents,
          maxBytes: 100000,
          nodeLabel: index.nodeLabel,
          splitter: dataSource.splitter,
          chunkSize: dataSource.chunkSize,
          chunkOverlap: dataSource.chunkOverlap,
          rephraseFunctionIds: dataSource.rephraseFunctionIds,
          workspaceId: dataSource.workspaceId,
          username: args.username,
          indexId: index.id,
          embeddingNodeProperty: index.embeddingNodeProperty,
          similarityMetric: index.similarityMetric,
          embeddingModel: index.embeddingModel,
          vectorStoreProvider: index.vectorStoreProvider,
        };

        const loaderProvider = getLoaderProvider(dataSource.type);
        const extractorProvider = getExtractorProvider(dataSource);
        await this.pipelinesService.executePipeline(params, loaderProvider, [extractorProvider]);
      }

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

  onStart({ args, model, modelParams, isBatch }: CompositionCallParams) {
    for (let callback of this.currentCallbacks) {
      callback.onCompositionStart({
        name: this.name,
        args,
        model,
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

const getExtractorProvider = (ds: any) => {
  if (ds.type === 'document') {
    if (ds.documentType === 'txt') {
      return 'text';
    }
    if (ds.documentType === 'csv') {
      return 'csv';
    }
    if (ds.documentType === 'json') {
      return 'json';
    }
  }
  if (['document', 'folder'].includes(ds.type)) {
    return 'unstructured';
  }
  if (ds.type === 'api') {
    return 'json';
  }
  if (ds.type === 'wikipedia') {
    return 'text';
  }
  if (ds.type === 'graphstore' && ds.graphstore === 'neo4j') {
    return 'neo4j';
  }
  if (ds.type === 'crawler') {
    return 'crawler';
  }
  throw new Error('Unsupported extractor');
};

const getLoaderProvider = (type: string) => {
  if (['document', 'folder'].includes(type)) {
    return 'minio';
  }
  if (['api', 'crawler', 'wikipedia'].includes(type)) {
    return type;
  }
  return null;
};

export interface ICompositionNode extends INode {
  composition: Composition;
}

export const composition = (name: string, nodes: Node[], edges: IEdge[], pipelinesService: any, callbacks: Callback[]) => {
  return new Composition({
    name,
    nodes,
    edges,
    pipelinesService,
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

class DataSourceNode implements IDataSourceNode {

  id: string;
  type: string;
  dataSource: any;

  constructor(id: string, dataSource: any) {
    this.id = id;
    this.type = 'sourceNode';
    this.dataSource = dataSource;
  }

}

class IndexNode implements IIndexNode {

  id: string;
  type: string;
  index: any;

  constructor(id: string, index: any) {
    this.id = id;
    this.type = 'indexNode';
    this.index = index;
  }

}

class ScheduleNode implements IScheduleNode {

  id: string;
  type: string;
  schedule: any;

  constructor(id: string, schedule: any) {
    this.id = id;
    this.type = 'scheduleNode';
    this.schedule = schedule;
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

export const sourceNode = (id: string, dataSource: any) => {
  return new DataSourceNode(id, dataSource);
};

export const indexNode = (id: string, index: any) => {
  return new IndexNode(id, index);
};

export const scheduleNode = (id: string, schedule: any) => {
  return new ScheduleNode(id, schedule);
};

export const edge = (id: string, source: string, target: string) => {
  return new Edge(id, source, target);
};
