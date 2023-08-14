import { default as dayjs } from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import merge from 'lodash.merge';
import { mapJsonAsync } from 'jsonpath-mapper';

import logger from '../logger';

import { DataMapper } from './common_types';
import { CompositionError } from './errors';
import { Callback } from './Callback';
import {
  CompositionCallParams,
  CompositionParams,
  IEdge,
  IRequestNode,
  IFunctionNode,
  IMapperNode,
  IJoinerNode,
  IOutputNode,
  Node,
  CompositionOnEndParams,
} from './Composition_types';
import { SemanticFunction } from './SemanticFunction';
// import { Tracer } from './Tracer';

dayjs.extend(relativeTime);

export class Composition {

  name: string;
  nodes: Node[];
  edges: IEdge[];
  dataMapper: DataMapper;
  callbacks: Callback[];
  currentCallbacks: Callback[];
  // tracer: Tracer;
  // startTime: Date;

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
    // this.tracer = new Tracer(this.getTraceName());
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
        if (node.type === 'functionNode') {
          let functionNode = node as IFunctionNode;
          let func = functionNode.func;
          // func.tracer = this.tracer;
          let response = await func.call({
            args: myargs,
            modelKey,
            modelParams,
            callbacks,
          });
          res = merge(res, response);
        } else if (node.type === 'mapperNode') {
          let mapperNode = node as IMapperNode;
          let mappingTemplate = mapperNode.mappingTemplate;
          let response = await this.mapArgs(myargs, mappingTemplate, isBatch);
          res = merge(res, response);
        } else {
          res = merge(res, myargs);
        }
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
      return response;

    } catch (err) {
      const errors = err.errors || [{ message: String(err) }];
      this.onEnd({ errors });
      throw err;
    }
  }

  async mapArgs(args: any, mappingTemplate: any, isBatch: boolean) {
    const mapped = await this._mapArgs(args, mappingTemplate, isBatch);
    // logger.debug('mapping node-to-node args');
    // logger.debug('args:', args);
    // logger.debug('mappingTemplate:', mappingTemplate);
    // if (!isBatch) {
    //   logger.debug('result:', mapped);
    // }
    for (let callback of this.currentCallbacks) {
      callback.onMapArguments({
        args,
        mapped,
        mappingTemplate,
        isBatch,
      });
    }
    // this.tracer.push({
    //   type: 'map-args',
    //   input: {
    //     type: 'function-node-args',
    //     values: !isBatch && args,
    //   },
    //   output: {
    //     type: 'args',
    //     values: !isBatch && mapped,
    //   },
    //   mappingTemplate,
    // });
    return mapped;
  }

  _mapArgs(args: any, mappingTemplate: any, isBatch: boolean): Promise<any> {
    const template = eval(`(${mappingTemplate})`);
    const mapData = (instance: object) => this.dataMapper(instance, template);
    if (isBatch) {
      return Promise.all(args.map(mapData));
    }
    return mapData(args);
  }

  getTraceName() {
    return ['impl', this.name, new Date().toISOString()].join(' - ');
  }

  onStart({ args, modelKey, modelParams, isBatch }: CompositionCallParams) {
    // logger.info('start composition');
    // this.startTime = new Date();
    // this.tracer.push({
    //   type: 'call-composition',
    //   model: {
    //     model: modelKey,
    //     modelParams,
    //   },
    //   isBatch,
    //   args,
    //   startTime: this.startTime.getTime(),
    // });
    for (let callback of this.currentCallbacks) {
      callback.onCompositionStart({
        name: this.name,
        args,
        modelKey,
        modelParams,
        isBatch,
        // trace: this.tracer.currentTrace(),
      });
    }
    // this.tracer.down();
  }

  onEnd({ response, errors }: CompositionOnEndParams) {
    // logger.info('end composition');
    // const endTime = new Date();
    // this.tracer
    //   .up()
    //   .addProperty('endTime', endTime.getTime())
    //   .addProperty('elapsedMillis', endTime.getTime() - this.startTime.getTime())
    //   .addProperty('elapsedReadable', dayjs(endTime).from(this.startTime))
    //   ;
    // if (errors) {
    //   this.tracer
    //     .addProperty('errors', errors)
    //     .addProperty('success', false)
    //     ;
    // } else {
    //   this.tracer
    //     .addProperty('response', response)
    //     .addProperty('success', true)
    //     ;
    // }
    for (let callback of this.currentCallbacks) {
      callback.onCompositionEnd({
        name: this.name,
        response,
        errors,
        // traceRecord: this.tracer.close(),
      });
    }
  }

  throwCompositionError(message: string) {
    const errors = [{ message }];
    // this.tracer.push({
    //   type: 'error',
    //   errors,
    // });
    for (let callback of this.currentCallbacks) {
      callback.onCompositionError(errors);
    }
    throw new CompositionError(message);
  }

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
