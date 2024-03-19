import { default as dayjs } from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import type { Schema } from 'jsonschema';
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
  ILoaderNode,
  IExtractorNode,
  ILoopNode,
  IMapperNode,
  IJoinerNode,
  IOutputNode,
  IDataSourceNode,
  IIndexNode,
  IScheduleNode,
  IVectorStoreNode,
  IEmbeddingNode,
  IGraphStoreNode,
  Node,
  EmbeddingModel,
} from './Composition_types';
import { SemanticFunction } from '../semanticfunctions/SemanticFunction';

dayjs.extend(relativeTime);

const ragPipelineNodes = [
  'loaderNode',
  'extractorNode',
  'embeddingNode',
  'vectorStoreNode',
  'graphStoreNode',
];

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

  async call({ args, model, modelParams, functions, isBatch, callbacks = [] }: CompositionCallParams) {
    this.currentCallbacks = [...this.callbacks, ...callbacks];
    this.onStart({ args, model, modelParams, isBatch });
    let dataSource: any;
    let index: any;
    const ragPipeline = {};

    const callFunction = async (node: Node, func: SemanticFunction, myargs: any) => {
      let response = await func.call({
        args: myargs,
        model,
        modelParams,
        functions,
      });
      const message = response.response.choices[0].message;
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
        // logger.debug(node.type, 'previous result:', res);
        return json;
      }
      return { content: message.content };
    }

    const resultCache: Map<string, { myargs: any, iter?: any[], aggregationVar?: any }> = new Map();

    const inner = async (node: Node): Promise<{ myargs: any, iter?: any[], aggregationVar?: any }> => {
      if (node.type === 'requestNode' || node.type === 'scheduleNode') {
        return { myargs: args };
      }
      let ret = resultCache[node.id];
      if (!ret) {
        const sourceIds = this.edges.filter(e => e.target === node.id).map(e => e.source);
        let res = {};
        let it: Array<any>;
        let aggVar: string;
        for (let sourceId of sourceIds) {
          let sourceNode = this.nodes.find(n => n.id === sourceId);
          if (!sourceNode) {
            logger.error(`Source node (${sourceId}) not found.`);
            logger.debug('nodes:', this.nodes);
            throw new CompositionError(`Source node (${sourceId}) not found.`);
          }
          let { myargs, iter, aggregationVar } = await inner(sourceNode);
          // logger.debug('from:', sourceNode.type, '\nmyargs:', myargs, '\naggregationVar:', aggregationVar, '\niter:', iter);

          if (node.type === 'functionNode') {
            let functionNode = node as IFunctionNode;
            let func = functionNode.func;
            if (iter) {
              let results = [];
              for (const el of iter) {
                const result = await callFunction(node, func, el);
                results.push(result);
              }
              res = merge(res, { results });
            } else {
              const json = await callFunction(node, func, myargs);
              res = merge(res, json);
            }

          } else if (node.type === 'compositionNode') {
            let compositionNode = node as ICompositionNode;
            let composition = compositionNode.composition;
            if (iter) {
              let results = [];
              for (const el of iter) {
                let { response } = await composition.call({
                  args: el,
                  model,
                  modelParams,
                });
                results.push(response);
              }
              res = merge(res, { [aggregationVar]: results });
            } else {
              let { response } = await composition.call({
                args: myargs,
                model,
                modelParams,
              });
              res = merge(res, response);
            }

          } else if (node.type === 'toolNode') {
            let toolNode = node as IToolNode;
            let tool = toolNode.tool;
            if (iter) {
              let results = [];
              for (const el of iter) {
                let params: any;
                if (typeof el === 'string') {
                  params = { input: el, num: 1 };
                } else {
                  params = { ...el, num: 1 };
                }
                let response = await tool.call(params, toolNode.raw);
                results.push(response);
              }
              res = merge(res, { [aggregationVar]: results });
            } else {
              let response = await tool.call(myargs, toolNode.raw);
              res = merge(res, response);
            }

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

          } else if (node.type === 'loopNode') {
            let loopNode = node as ILoopNode;
            res = merge(res, myargs);
            it = res[loopNode.loopVar];
            aggVar = loopNode.aggregationVar;
            // break;

          } else if (node.type === 'joinerNode') {
            res = merge(res, myargs);

          } else if (node.type === 'sourceNode') {
            let dataSourceNode = node as IDataSourceNode;
            dataSource = dataSourceNode.dataSource;

          } else if (node.type === 'indexNode') {
            let indexNode = node as IIndexNode;
            index = indexNode.index;

          } else if (ragPipelineNodes.includes(node.type)) {
            ragPipeline[node.type] = node;

          } else {
            res = merge(res, myargs);
          }
        }
        ret = { myargs: res, aggregationVar: aggVar, iter: it };
        resultCache[node.id] = ret;
      }
      return ret;
    }

    try {
      const output = this.nodes.find(n => n.type === 'outputNode');
      if (!output) {
        throw new CompositionError('No output node found');
      }

      let response = await inner(output);

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
        response = await this.pipelinesService.executePipeline(params, loaderProvider, [extractorProvider]);
      }

      if (ragPipeline['vectorStoreNode'] || ragPipeline['graphStoreNode']) {
        logger.debug('ragPipeline:', ragPipeline);
        let params: any = ragPipelineNodes.reduce((a, n) => {
          if (ragPipeline[n]) {
            a = { ...a, ...ragPipeline[n].getDataDict() };
          }
          return a;
        }, {});
        params = {
          ...params,
          workspaceId: args.workspaceId,
          username: args.username,
          embeddingModel: params.embeddingModel?.model,
        };
        logger.debug('params:', params);
        const loaderNode = ragPipeline['loaderNode'] as ILoaderNode;
        const loaderProvider = loaderNode.loader;
        const extractorNode = ragPipeline['extractorNode'] as IExtractorNode;
        const extractorProvider = extractorNode.extractor;
        response = await this.pipelinesService.executePipeline(params, loaderProvider, [extractorProvider]);
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
  raw: boolean;

  constructor(id: string, tool: Tool, raw: boolean) {
    this.id = id;
    this.type = 'toolNode';
    this.tool = tool;
    this.raw = raw;
  }

}

interface LoaderNodeParams {
  loader: string;

  // api
  endpoint?: string;
  schema?: Schema;

  // crawler
  baseUrl?: string;
  maxRequestsPerCrawl?: number;
  chunkElement?: string;
  scrapingSpec?: Schema;

  // minio
  bucket?: string;
  prefix?: string;
  recursive?: boolean;

  // wikipedia, gmail
  query?: string;

  // confluence
  spaceKey?: string;
}

class LoaderNode implements ILoaderNode {

  id: string;
  type: string;
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

  constructor(id: string, params: Partial<LoaderNodeParams>) {
    this.id = id;
    this.type = 'loaderNode';
    this.loader = params.loader;
    this.endpoint = params.endpoint;
    this.schema = params.schema;
    this.baseUrl = params.baseUrl;
    this.maxRequestsPerCrawl = params.maxRequestsPerCrawl;
    this.chunkElement = params.chunkElement;
    this.scrapingSpec = params.scrapingSpec;
    this.bucket = params.bucket;
    this.prefix = params.prefix;
    this.recursive = params.recursive;
    this.query = params.query;
    this.spaceKey = params.spaceKey;
  }

  getDataDict() {
    return {
      endpoint: this.endpoint,
      schema: this.schema,
      baseUrl: this.baseUrl,
      maxRequestsPerCrawl: this.maxRequestsPerCrawl,
      chunkElement: this.chunkElement,
      scrapingSpec: this.scrapingSpec,
      bucket: this.bucket,
      prefix: this.prefix,
      recursive: this.recursive,
      query: this.query,
      spaceKey: this.spaceKey,
    };
  }

}

interface ExtractorNodeParams {
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

class ExtractorNode implements IExtractorNode {

  id: string;
  type: string;
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

  constructor(id: string, params: Partial<ExtractorNodeParams>) {
    this.id = id;
    this.type = 'extractorNode';
    this.extractor = params.extractor;
    this.delimiter = params.delimiter;
    this.quoteChar = params.quoteChar;
    this.nodeLabel = params.nodeLabel;
    this.embeddingNodeProperty = params.embeddingNodeProperty;
    this.textNodeProperties = params.textNodeProperties;
    this.limit = params.limit;
    this.splitter = params.splitter;
    this.characters = params.characters;
    this.functionId = params.functionId;
    this.chunkSize = params.chunkSize;
    this.chunkOverlap = params.chunkOverlap;
    this.rephraseFunctionIds = params.rephraseFunctionIds;
  }

  getDataDict() {
    return {
      // csv
      delimiter: this.delimiter,
      quoteChar: this.quoteChar,

      // neo4j
      nodeLabel: this.nodeLabel,
      embeddingNodeProperty: this.embeddingNodeProperty,
      textNodeProperties: this.textNodeProperties,
      limit: this.limit,

      // text
      splitter: this.splitter,
      rephraseFunctionIds: this.rephraseFunctionIds,
      // text [splitter=delimiter]
      characters: this.characters,
      // text [splitter=chunker]
      functionId: this.functionId,
      // text [splitter=token]
      chunkSize: this.chunkSize,
      chunkOverlap: this.chunkOverlap,
    };
  }

}

class VectorStoreNode implements IVectorStoreNode {

  id: string;
  type: string;
  vectorStoreProvider: string;
  newIndexName: string;

  constructor(id: string, vectorStoreProvider: string, newIndexName: string) {
    this.id = id;
    this.type = 'vectorStoreNode';
    this.vectorStoreProvider = vectorStoreProvider;
    this.newIndexName = newIndexName;
  }

  getDataDict() {
    return {
      vectorStoreProvider: this.vectorStoreProvider,
      newIndexName: this.newIndexName,
    };
  }

}

class GraphStoreNode implements IGraphStoreNode {

  id: string;
  type: string;
  graphStoreProvider: string;

  constructor(id: string, graphStoreProvider: string) {
    this.id = id;
    this.type = 'graphStoreNode';
    this.graphStoreProvider = graphStoreProvider;
  }

  getDataDict() {
    return {
      graphStoreProvider: this.graphStoreProvider,
    };
  }

}

class EmbeddingNode implements IEmbeddingNode {

  id: string;
  type: string;
  embeddingModel: EmbeddingModel;

  constructor(id: string, embeddingModel: EmbeddingModel) {
    this.id = id;
    this.type = 'embeddingNode';
    this.embeddingModel = embeddingModel;
  }

  getDataDict() {
    return {
      embeddingModel: this.embeddingModel,
    };
  }

}

class LoopNode implements ILoopNode {

  id: string;
  type: string;
  loopVar: string;
  aggregationVar: string;

  constructor(id: string, loopVar: string, aggregationVar: string) {
    this.id = id;
    this.type = 'loopNode';
    this.loopVar = loopVar;
    this.aggregationVar = aggregationVar;
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

export const toolNode = (id: string, tool: Tool, raw: boolean) => {
  return new ToolNode(id, tool, raw);
};

export const loaderNode = (id: string, params: LoaderNodeParams) => {
  return new LoaderNode(id, params);
};

export const extractorNode = (id: string, params: ExtractorNodeParams) => {
  return new ExtractorNode(id, params);
};

export const vectorStoreNode = (id: string, vectorStoreProvider: string, newIndexName: string) => {
  return new VectorStoreNode(id, vectorStoreProvider, newIndexName);
};

export const graphStoreNode = (id: string, graphStoreProvider: string) => {
  return new GraphStoreNode(id, graphStoreProvider);
};

export const embeddingNode = (id: string, embeddingModel: EmbeddingModel) => {
  return new EmbeddingNode(id, embeddingModel);
};

export const loopNode = (id: string, loopVar: string, aggregationVar: string) => {
  return new LoopNode(id, loopVar, aggregationVar);
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
