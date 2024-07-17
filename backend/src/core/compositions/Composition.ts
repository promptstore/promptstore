import { default as dayjs } from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import type { Schema } from 'jsonschema';
import merge from 'lodash.merge';
import { mapJsonAsync } from 'jsonpath-mapper';

import logger from '../../logger';

import { Tool } from '../../agents/Agent_types';
import { AgentRuntime } from '../../agents/AgentRuntime';
import { DataMapper, Source } from '../common_types';
import { CompositionError } from '../errors';
import { Callback } from '../callbacks/Callback';
import { Function } from '../conversions/RosettaStone';
import { DataSource } from '../indexers/DataSource';
import {
  CompositionCallParams,
  CompositionOnEndParams,
  CompositionParams,
  EmbeddingModel,
  IAgentNode,
  IDataSourceNode,
  IEdge,
  IEmbeddingNode,
  IExtractorNode,
  IFunctionNode,
  IFunctionRouterNode,
  IGraphStoreNode,
  IIndexNode,
  IJoinerNode,
  ILoaderNode,
  ILoopNode,
  IMapperNode,
  INode,
  IOutputNode,
  IRequestNode,
  IScheduleNode,
  IToolCapable,
  IToolNode,
  ITransformerNode,
  IVectorStoreNode,
  Node,
} from './Composition_types';
import { SemanticFunction } from '../semanticfunctions/SemanticFunction';

dayjs.extend(relativeTime);

const TOOL_CAPABLE_NODES = ['agentNode', 'compositionNode', 'functionNode', 'toolNode'];

const ragPipelineNodes = [
  'loaderNode',
  'extractorNode',
  'embeddingNode',
  'vectorStoreNode',
  'graphStoreNode',
  'transformerNode',
  'indexNode',
];

interface InnerResult {
  aggregationVar: any;
  iter: any[];
  myargs: any;
  reverseErrorFlowSource: string;
}

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

  async call({ args, model, modelParams, functions, isBatch, callbacks = [], workspaceId, username }: CompositionCallParams) {
    this.currentCallbacks = [...this.callbacks, ...callbacks];
    this.onStart({ args, model, modelParams, isBatch, workspaceId, username });
    let dataSource: any;
    let index: any;
    const ragPipeline = {};

    const callAgent = async (agent: AgentRuntime, args: any) => {
      logger.debug('!!!! callAgent myargs:', args);
      const content = await agent.call({
        callbacks: [],
        email: '',  // TODO
        args,
        workspaceId,
        username,
        parentAgentName: undefined,
      });
      return { content };
    };

    const callFunction = async (func: SemanticFunction, args: any, funcs: Function[]) => {
      logger.debug('!!!! callFunction args:', args);
      const fns = [...(functions || []), ...(funcs || [])];
      const response = await func.call({
        args,
        model,
        modelParams,
        functions: fns.length ? fns : undefined,
      });
      const messages = response.response.choices.map((c: any) => c.message);
      // const message = response.response.choices[0].message;
      // if (func.returnType === 'application/json') {
      //   let json: any;
      //   try {
      //     if (func.returnTypeSchema && message.function_call) {
      //       json = JSON.parse(message.function_call.arguments);
      //     } else {
      //       json = JSON.parse(message.content);
      //     }
      //   } catch (err) {
      //     logger.error('error parsing json response:', err);
      //     json = {};
      //   }
      //   return json;
      // }
      // return { content: message.content };
      return { messages };
    };

    const executeNode = async (node: Node, sourceNode: Node, nextNode: Node, { myargs, iter, aggregationVar }, res: any) => {
      logger.debug('^^^^^^^^^^^^^^^^^^^^^^ res:', res)
      logger.debug('^^^^^^^^^^^^^^^^^^^^^^ myargs:', myargs)
      let it: any[];
      let aggVar: string;
      if (node.type === 'agentNode') {
        let agentNode = node as IAgentNode;
        let agent = agentNode.agent;
        if (iter) {
          let results = [];
          for (const el of iter) {
            const result = await callAgent(agent, el);
            results.push(result);
          }
          res = merge(res, { results });
        } else {
          const json = await callAgent(agent, myargs);
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
              workspaceId,
              username,
            });
            results.push(response);
          }
          res = merge(res, { [aggregationVar]: results });
        } else {
          let { response } = await composition.call({
            args: myargs,
            model,
            modelParams,
            workspaceId,
            username,
          });
          res = merge(res, response);
        }

      } else if (node.type === 'functionNode') {
        const functionNode = node as IFunctionNode;
        const { func, functions } = functionNode;

        const getResults = async (args: any) => {
          const { messages } = await callFunction(func, args, functions);
          return messages.map((message: any) => {
            const call = message.function_call;
            if (call) {
              const parsedArgs = JSON.parse(call.arguments);
              if (nextNode.type === 'functionRouterNode') {
                return { ...call, arguments: parsedArgs };
              }
              return parsedArgs;
            }
            return { content: message.content };
          });
        };

        if (iter) {
          const results = [];
          for (const args of iter) {
            const rs = await getResults(args);
            if (rs.length === 1 && nextNode.type !== 'functionRouterNode') {
              results.push(rs[0]);
            } else {
              results.push(rs)
            }
          }
          res = merge(res, { results });
        } else {
          const results = await getResults(myargs);
          if (results.length === 1 && nextNode.type !== 'functionRouterNode') {
            res = merge(res, results[0]);
          } else {
            res = merge(res, { results });
          }
        }

      } else if (node.type === 'functionRouterNode') {
        if (TOOL_CAPABLE_NODES.includes(nextNode.type) && myargs.results?.length) {
          const tool = nextNode as IToolCapable;
          const name = tool.name;
          logger.debug('^^^^^^^^^^^^^^^^^^^^^^ name:', name)
          for (const r of myargs.results) {
            logger.debug('^^^^^^^^^^^^^^^^^^^^^^ r:', r)
            if (r.name.toLowerCase() === name.toLowerCase()) {
              res = merge(res, r.arguments);
              break;
            }
          }
        }

      } else if (node.type === 'indexNode') {
        let indexNode = node as IIndexNode;
        index = indexNode.index;
        ragPipeline[node.type] = node;

      } else if (node.type === 'joinerNode') {
        res = merge(res, myargs);

      } else if (node.type === 'loopNode') {
        let loopNode = node as ILoopNode;
        res = merge(res, myargs);
        it = res[loopNode.loopVar];
        aggVar = loopNode.aggregationVar;

      } else if (node.type === 'mapperNode') {
        const mapperNode = node as IMapperNode;
        const mappingTemplate = mapperNode.mappingTemplate;
        sourceNode ||= node;
        const source: Source = {
          type: sourceNode.type.slice(0, -4),
        };
        if (sourceNode.type === 'functionNode') {
          source.name = (sourceNode as IFunctionNode).func.name;
        }
        const response = await this.mapArgs(source, myargs, mappingTemplate, isBatch);
        res = merge(res, response);

      } else if (node.type === 'sourceNode') {
        let dataSourceNode = node as IDataSourceNode;
        dataSource = dataSourceNode.dataSource;

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

      } else if (ragPipelineNodes.includes(node.type)) {
        ragPipeline[node.type] = node;
        res = merge(res, myargs);

      } else {
        res = merge(res, myargs);
      }

      return { aggregationVar: aggVar, iter: it, myargs: res, reverseErrorFlowSource: null };
    }

    let resultCache: Map<string, InnerResult> = new Map();

    const innerError = async (node: Node, response: InnerResult, errorSourceId: string): Promise<InnerResult> => {
      logger.debug('!!!! process node:', node.type);
      if (node.type === 'outputNode') {
        return { aggregationVar: null, iter: null, myargs: args, reverseErrorFlowSource: null };
      }
      const targetIds = this.edges
        .filter(e => e.source === node.id && e.sourceHandle !== 'error')
        .map(e => e.target);

      const errorTargetIds = this.edges
        .filter(e => e.source === node.id && e.sourceHandle === 'error')
        .map(e => e.target);

      let res = {};
      let it: any[];
      let aggVar: string;
      for (let targetId of targetIds) {
        let targetNode = this.nodes.find(n => n.id === targetId);
        logger.debug('!!!! process target:', targetNode.type);
        if (!targetNode) {
          let message = `Target node (${targetId}) not found.`;
          logger.error(message);
          logger.debug('nodes:', this.nodes);
          throw new CompositionError(message);
        }
        try {
          logger.debug('!!!! call innerError:', targetNode.type);
          response = await executeNode(node, null, null, response, res);
          logger.debug('!!!! response:', response, 'current node:', node.id);
          if (errorSourceId !== node.id) {
            response = await innerError(targetNode, response, errorSourceId);
          }
          aggVar = response.aggregationVar;
          it = response.iter;
          res = response.myargs;

        } catch (err) {
          let message = err.message;
          if (err.stack) {
            message += '\n' + err.stack;
          }
          logger.error(message);
          if (errorTargetIds.length) {
            for (let errorTargetId of errorTargetIds) {  // there should be 0 or 1
              let targetNode = this.nodes.find(n => n.id === errorTargetId);
              if (!targetNode) {
                let message = `Target node (${errorTargetId}) not found.`;
                logger.error(message);
                logger.debug('nodes:', this.nodes);
                throw new CompositionError(message);
              }
              response = await innerError(targetNode, response, node.id);
              aggVar = response.aggregationVar;
              it = response.iter;
              res = response.myargs;
            }
          } else {
            throw new CompositionError(err.message);
          }
        }
      }
      return { aggregationVar: aggVar, iter: it, myargs: res, reverseErrorFlowSource: null };
    }

    const inner = async (node: Node, nextNode: Node = null): Promise<InnerResult> => {
      logger.debug('==== process node:', node.type);
      let ret: InnerResult;
      if (node.type === 'requestNode' || node.type === 'scheduleNode') {
        return { aggregationVar: null, iter: null, myargs: args, reverseErrorFlowSource: null };
      }
      ret = resultCache[node.id];
      if (!ret) {
        // if (true) {
        const sourceIds = this.edges
          .filter(e => e.target === node.id)
          .map(e => e.source);

        const errorTargetIds = this.edges
          .filter(e => e.source === node.id && e.sourceHandle === 'error')
          .map(e => e.target);

        let res = {};
        let it: any[];
        let aggVar: string;
        for (let sourceId of sourceIds) {
          let sourceNode = this.nodes.find(n => n.id === sourceId);
          logger.debug('==== process source:', sourceNode?.type);
          if (!sourceNode) {
            let message = `Source node (${sourceId}) not found.`;
            logger.error(message);
            logger.debug('nodes:', this.nodes);
            logger.debug('edges:', this.edges);
            throw new CompositionError(message);
          }

          if (node.type === 'functionNode') {
            const functions = [];
            if (nextNode.type === 'toolNode') {
              const toolNode = nextNode as IToolNode;
              functions.push(toolNode.tool.getOpenAPIMetadata());
            } else if (nextNode.type === 'functionRouterNode') {
              const functionRouterNode = nextNode as IFunctionRouterNode;
              functions.push(...functionRouterNode.functions);
            }
            const functionNode = node as IFunctionNode;
            functionNode.functions = functions;
          } else if (node.type === 'functionRouterNode') {
            if (nextNode.type === 'toolNode') {
              const toolNode = nextNode as IToolNode;
              const functionRouterNode = node as IFunctionRouterNode;
              functionRouterNode.addFunction(toolNode.tool.getOpenAPIMetadata());
            }
          }

          const isReverseErrorFlow = this.edges.some(e => {
            return (
              e.target === node.id &&
              e.source === sourceId &&
              e.sourceHandle === 'error'
            );
          });
          logger.debug('==== isReverseErrorFlow:', isReverseErrorFlow);
          if (isReverseErrorFlow) {
            logger.debug('====', sourceNode.type, '=>', node.type);
            return { aggregationVar: null, iter: null, myargs: null, reverseErrorFlowSource: sourceId };
          }
          let response: InnerResult;
          try {
            logger.debug('==== call inner:', sourceNode.type);
            response = await inner(sourceNode, node);
            logger.debug('==== response:', response, 'current node:', node.id);
            if (response.reverseErrorFlowSource && response.reverseErrorFlowSource === node.id) {
              return { aggregationVar: aggVar, iter: it, myargs: res, reverseErrorFlowSource: null };
            }
            logger.debug('********************** node:', node)
            logger.debug('********************** res:', res)
            response = await executeNode(node, sourceNode, nextNode, response, res);
            logger.debug('$$$$$$$$$$$$$$$$$$$$$$ response:', response);
            if (response.myargs.error) {
              if (errorTargetIds.length) {
                for (let errorTargetId of errorTargetIds) {  // there should be 0 or 1
                  let targetNode = this.nodes.find(n => n.id === errorTargetId);
                  if (!targetNode) {
                    let message = `Target node (${errorTargetId}) not found.`;
                    logger.error(message);
                    logger.debug('nodes:', this.nodes);
                    throw new CompositionError(message);
                  }
                  resultCache = new Map();
                  response = await innerError(targetNode, response, node.id);
                  aggVar = response.aggregationVar;
                  it = response.iter;
                  res = response.myargs;
                }
              } else {
                throw new CompositionError(response.myargs.error);
              }
            } else {
              aggVar = response.aggregationVar;
              it = response.iter;
              res = response.myargs;
            }

          } catch (err) {
            let message = err.message;
            if (err.stack) {
              message += '\n' + err.stack;
            }
            logger.error(message);
            if (errorTargetIds.length) {
              for (let errorTargetId of errorTargetIds) {  // there should be 0 or 1
                let targetNode = this.nodes.find(n => n.id === errorTargetId);
                if (!targetNode) {
                  let message = `Target node (${errorTargetId}) not found.`;
                  logger.error(message);
                  logger.debug('nodes:', this.nodes);
                  throw new CompositionError(message);
                }
                resultCache = new Map();
                response = await innerError(targetNode, response, node.id);
                aggVar = response.aggregationVar;
                it = response.iter;
                res = response.myargs;
              }
            } else {
              throw new CompositionError(err.message);
            }
          }
        }
        ret = { aggregationVar: aggVar, iter: it, myargs: res, reverseErrorFlowSource: null };
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

      logger.debug('!!!!!!!!!!!!!!!!!!!!!! response:', response);

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

      if (ragPipeline['vectorStoreNode'] || ragPipeline['graphStoreNode'] || ragPipeline['indexNode']) {
        let params: any = ragPipelineNodes.reduce((a, n) => {
          if (ragPipeline[n]) {
            a = { ...a, ...ragPipeline[n].getDataDict() };
          }
          return a;
        }, {});
        let graphSchema: any;
        if (params.index) {
          const { graphStoreProvider, schema } = params.index;
          if (graphStoreProvider && schema) {
            graphSchema = {
              nodes: schema.nodes.map((n: any) => JSON.stringify(n.data)),
              edges: schema.edges.map((e: any) => JSON.stringify(e.data)),
            };
          }
        }
        params = {
          ...params,
          ...response.myargs,
          workspaceId: args.workspaceId,
          username: args.username,
          embeddingModel: params.embeddingModel?.model,
          graphSchema,
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

  onStart({ args, model, modelParams, isBatch, workspaceId, username }: CompositionCallParams) {
    for (let callback of this.currentCallbacks) {
      callback.onCompositionStart({
        name: this.name,
        args,
        model,
        modelParams,
        isBatch,
        workspaceId,
        username,
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

export interface ICompositionNode extends IToolCapable {
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

class Edge implements IEdge {

  id: string;
  source: string;
  sourceHandle: string;
  target: string;

  constructor(id: string, source: string, sourceHandle: string, target: string) {
    this.id = id;
    this.source = source;
    this.sourceHandle = sourceHandle;
    this.target = target;
  }

}

class AgentNode implements IAgentNode {

  id: string;
  type: string;
  agent: AgentRuntime;

  constructor(id: string, agent: AgentRuntime) {
    this.id = id;
    this.type = 'agentNode';
    this.agent = agent;
  }

  get name(): string {
    return this.agent.name;
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

  get name(): string {
    return this.composition.name;
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

class FunctionNode implements IFunctionNode {

  id: string;
  type: string;
  func: SemanticFunction;
  functions: Function[];

  constructor(id: string, func: SemanticFunction) {
    this.id = id;
    this.type = 'functionNode';
    this.func = func;
  }

  get name(): string {
    return this.func.name;
  }

}

class FunctionRouterNode implements IFunctionRouterNode {

  id: string;
  type: string;
  functions: Function[];

  constructor(id: string) {
    this.id = id;
    this.type = 'functionRouterNode';
    this.functions = [];
  }

  addFunction(func: Function) {
    this.functions.push(func);
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

class IndexNode implements IIndexNode {

  id: string;
  type: string;
  index: any;

  constructor(id: string, index: any) {
    this.id = id;
    this.type = 'indexNode';
    this.index = index;
  }

  getDataDict() {
    return {
      index: this.index,
    };
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

class OutputNode implements IOutputNode {

  id: string;
  type: string;

  constructor(id: string) {
    this.id = id;
    this.type = 'outputNode';
  }

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

  get name(): string {
    return this.tool.__name;
  }

}

class TransformerNode implements ITransformerNode {

  id: string;
  type: string;
  functionId: number;

  constructor(id: string, functionId: number) {
    this.id = id;
    this.type = 'transformerNode';
    this.functionId = functionId;
  }

  getDataDict() {
    return {
      functionId: this.functionId,
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

export const edge = (id: string, source: string, sourceHandle: string, target: string) => {
  return new Edge(id, source, sourceHandle, target);
};

export const agentNode = (id: string, agent: AgentRuntime) => {
  return new AgentNode(id, agent);
};

export const compositionNode = (id: string, composition: Composition) => {
  return new CompositionNode(id, composition);
};

export const embeddingNode = (id: string, embeddingModel: EmbeddingModel) => {
  return new EmbeddingNode(id, embeddingModel);
};

export const extractorNode = (id: string, params: ExtractorNodeParams) => {
  return new ExtractorNode(id, params);
};

export const functionNode = (id: string, func: SemanticFunction) => {
  return new FunctionNode(id, func);
};

export const functionRouterNode = (id: string) => {
  return new FunctionRouterNode(id);
};

export const graphStoreNode = (id: string, graphStoreProvider: string) => {
  return new GraphStoreNode(id, graphStoreProvider);
};

export const indexNode = (id: string, index: any) => {
  return new IndexNode(id, index);
};

export const joinerNode = (id: string) => {
  return new JoinerNode(id);
};

export const loaderNode = (id: string, params: LoaderNodeParams) => {
  return new LoaderNode(id, params);
};

export const loopNode = (id: string, loopVar: string, aggregationVar: string) => {
  return new LoopNode(id, loopVar, aggregationVar);
};

export const mapperNode = (id: string, mappingTemplate: string) => {
  return new MapperNode(id, mappingTemplate);
}

export const outputNode = (id: string) => {
  return new OutputNode(id);
};

export const requestNode = (id: string, argsSchema: object) => {
  return new RequestNode(id, argsSchema);
};

export const scheduleNode = (id: string, schedule: any) => {
  return new ScheduleNode(id, schedule);
};

export const sourceNode = (id: string, dataSource: any) => {
  return new DataSourceNode(id, dataSource);
};

export const toolNode = (id: string, tool: Tool, raw: boolean) => {
  return new ToolNode(id, tool, raw);
};

export const transformerNode = (id: string, functionId: number) => {
  return new TransformerNode(id, functionId);
};

export const vectorStoreNode = (id: string, vectorStoreProvider: string, newIndexName: string) => {
  return new VectorStoreNode(id, vectorStoreProvider, newIndexName);
};
