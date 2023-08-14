import { default as dayjs } from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import get from 'lodash.get';
import set from 'lodash.set';  // mutable
import clone from 'lodash.clonedeep';

import logger from '../logger';

import { SemanticFunctionError } from './errors';
import { Callback } from './Callback';
import { ModelParams } from './Model_types';
import {
  PromptEnrichmentPipelineParams,
  PromptEnrichmentStep,
  PromptEnrichmentCallParams,
  PromptEnrichmentOnEndParams,
  FeatureStoreEnrichmentParams,
  FeatureStoreParams,
  OnFeatureStoreEnrichmentEndParams,
  SearchIndexEnrichmentParams,
  IndexParams,
  OnSemanticSearchEnrichmentEndParams,
  FunctionEnrichmentParams,
  OnFunctionEnrichmentEndParams,
  SqlEnrichmentParams,
  OnSqlEnrichmentEndParams,
} from './PromptEnrichmentPipeline_types';
import { PromptTemplate } from './PromptTemplate';
import { SemanticFunction } from './SemanticFunction';
// import { Tracer } from './Tracer';

dayjs.extend(relativeTime);

export class PromptEnrichmentPipeline {

  promptTemplate: PromptTemplate;
  steps: PromptEnrichmentStep[];
  callbacks: Callback[];
  currentCallbacks: Callback[];
  // tracer: Tracer;
  // startTime: Date;

  constructor({
    promptTemplate,
    steps,
    callbacks,
  }: PromptEnrichmentPipelineParams) {
    this.promptTemplate = promptTemplate;
    this.steps = steps;
    this.callbacks = callbacks || [];
    // this.tracer = new Tracer(this.getTraceName());
  }

  async call({ args, callbacks = [] }: PromptEnrichmentCallParams) {
    this.currentCallbacks = [...this.callbacks, ...callbacks];
    this.onStart({ args });
    try {
      for (const step of this.steps) {
        // step.tracer = this.tracer;
        args = await step.call({ args, callbacks });
      }
      // this.promptTemplate.tracer = this.tracer;
      const messages = this.promptTemplate.call({ args, callbacks });
      this.onEnd({ messages });
      return messages;
    } catch (err) {
      const errors = err.errors || [{ message: String(err) }];
      this.onEnd({ errors });
      throw err;
    }
  }

  getTraceName() {
    return ['prompt-enrichment-pipeline', new Date().toISOString()].join(' - ');
  }

  onStart({ args }: PromptEnrichmentCallParams) {
    // logger.info('start enrichment pipeline');
    // this.startTime = new Date();
    // this.tracer.push({
    //   type: 'enrichment-pipeline',
    //   args,
    //   startTime: this.startTime.getTime(),
    // });
    for (let callback of this.currentCallbacks) {
      callback.onPromptEnrichmentStart({
        args,
        // trace: this.tracer.currentTrace(),
      });
    }
    // this.tracer.down();
  }

  onEnd({ messages, errors }: PromptEnrichmentOnEndParams) {
    // logger.info('end enrichment pipeline');
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
    //     .addProperty('messages', messages)
    //     .addProperty('success', true)
    //     ;
    // }
    for (let callback of this.currentCallbacks) {
      callback.onPromptEnrichmentEnd({
        messages,
        errors,
        // trace: this.tracer.currentTrace(),
      });
    }
  }

  throwSemanticFunctionError(message: string) {
    const errors = [{ message }];
    // this.tracer.push({
    //   type: 'error',
    //   errors,
    // });
    for (let callback of this.currentCallbacks) {
      callback.onPromptEnrichmentError(errors);
    }
    throw new SemanticFunctionError(message);
  }

}

export class FeatureStoreEnrichment implements PromptEnrichmentStep {

  featurestore: string;
  featureStoreParams: FeatureStoreParams;
  featureStoreService: any;
  callbacks: Callback[];
  currentCallbacks: Callback[];
  // tracer: Tracer;
  // startTime: Date;

  constructor({
    featurestore,
    featureStoreParams,
    featureStoreService,
    callbacks,
  }: FeatureStoreEnrichmentParams) {
    this.featurestore = featurestore;
    this.featureStoreParams = featureStoreParams;
    this.featureStoreService = featureStoreService;
    this.callbacks = callbacks || [];
    // this.tracer = new Tracer(this.getTraceName());
  }

  async call({ args, callbacks }: PromptEnrichmentCallParams) {
    this.currentCallbacks = [...this.callbacks, ...callbacks];
    this.onStart({ args });
    try {
      const values = await this.featureStoreService.getOnlineFeatures(
        this.featurestore,
        this.featureStoreParams,
        args.entityId
      );
      const enrichedArgs = {
        ...args,
        ...values
      };
      this.onEnd({ enrichedArgs });
      return enrichedArgs;
    } catch (err) {
      const errors = err.errors || [{ message: String(err) }];
      this.onEnd({ errors });
      throw err;
    }
  }

  getTraceName() {
    return [this.featurestore, new Date().toISOString()].join(' - ');
  }

  onStart({ args }: PromptEnrichmentCallParams) {
    // logger.info('start enrichment from feature store', this.featurestore);
    // this.startTime = new Date();
    // this.tracer.push({
    //   type: 'feature-store-enrichment',
    //   featureStore: {
    //     name: this.featurestore,
    //     params: this.featureStoreParams,
    //   },
    //   args,
    //   startTime: this.startTime.getTime(),
    // });
    for (let callback of this.currentCallbacks) {
      callback.onFeatureStoreEnrichmentStart({
        featureStore: {
          name: this.featurestore,
          params: this.featureStoreParams,
        },
        args,
        // trace: this.tracer.currentTrace(),
      });
    }
    // this.tracer.down();
  }

  onEnd({ enrichedArgs, errors }: OnFeatureStoreEnrichmentEndParams) {
    // logger.info('end enrichment from feature store', this.featurestore);
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
    //     .addProperty('enrichedArgs', enrichedArgs)
    //     .addProperty('success', true)
    //     ;
    // }
    for (let callback of this.currentCallbacks) {
      callback.onFeatureStoreEnrichmentEnd({
        featureStore: {
          name: this.featurestore,
          params: this.featureStoreParams,
        },
        enrichedArgs,
        errors,
        // trace: this.tracer.currentTrace(),
      });
    }
  }

  throwSemanticFunctionError(message: string) {
    const errors = [{ message }];
    // this.tracer.push({
    //   type: 'error',
    //   errors,
    // });
    for (let callback of this.currentCallbacks) {
      callback.onFeatureStoreEnrichmentError(errors);
    }
    throw new SemanticFunctionError(message);
  }

}

export class SemanticSearchEnrichment implements PromptEnrichmentStep {

  indexName: string;
  indexParams: IndexParams;
  searchService: any;
  callbacks: Callback[];
  currentCallbacks: Callback[];
  // tracer: Tracer;
  // startTime: Date;

  constructor({
    indexName,
    indexParams,
    searchService,
    callbacks,
  }: SearchIndexEnrichmentParams) {
    this.indexName = indexName;
    this.indexParams = indexParams;
    this.searchService = searchService;
    this.callbacks = callbacks || [];
    // this.tracer = new Tracer(this.getTraceName());
  }

  async call({ args, callbacks = [] }: PromptEnrichmentCallParams) {
    this.currentCallbacks = [...this.callbacks, ...callbacks];
    this.onStart({ args });
    try {
      const query = this.getQuery(args);
      const results = await this.searchService.search(this.indexName, query);
      const contextLines = results.map((r: any) => r.content_text);
      const context = contextLines.join('\n\n');
      const enrichedArgs = this.enrich(args, context);
      this.onEnd({ enrichedArgs });
      return enrichedArgs;
    } catch (err) {
      const errors = err.errors || [{ message: String(err) }];
      this.onEnd({ errors });
      throw err;
    }
  }

  enrich(args: any, context: string) {
    const contextPath = this.indexParams.indexContextPropertyPath || 'context';
    const existingContext = get(args, contextPath);
    if (existingContext) {
      if (typeof existingContext !== 'string') {
        this.throwSemanticFunctionError(`existing context found at ${contextPath} is an incompatible type`);
      }
      return set(clone(args), contextPath, [existingContext, context].join('\n\n'));
    }
    return set(clone(args), contextPath, context);
  }

  getQuery(args: any) {
    const { allResults, indexContentPropertyPath } = this.indexParams;
    if (allResults) {
      return '*';
    }
    if (!indexContentPropertyPath || indexContentPropertyPath === 'root') {
      return args;
    }
    return get(args, indexContentPropertyPath);
  }

  getTraceName() {
    return [this.indexName, new Date().toISOString()].join(' - ');
  }

  onStart({ args }: PromptEnrichmentCallParams) {
    // logger.info('start enrichment from index', this.indexName);
    // this.startTime = new Date();
    // this.tracer.push({
    //   type: 'semantic-search-enrichment',
    //   index: {
    //     name: this.indexName,
    //     params: this.indexParams,
    //   },
    //   args,
    //   startTime: this.startTime.getTime(),
    // });
    for (let callback of this.currentCallbacks) {
      callback.onSemanticSearchEnrichmentStart({
        index: {
          name: this.indexName,
          params: this.indexParams,
        },
        args,
        // trace: this.tracer.currentTrace(),
      });
    }
    // this.tracer.down();
  }

  onEnd({ enrichedArgs, errors }: OnSemanticSearchEnrichmentEndParams) {
    // logger.info('end enrichment from index', this.indexName);
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
    //     .addProperty('enrichedArgs', enrichedArgs)
    //     .addProperty('success', true)
    //     ;
    // }
    for (let callback of this.currentCallbacks) {
      callback.onSemanticSearchEnrichmentEnd({
        index: {
          name: this.indexName,
          params: this.indexParams,
        },
        enrichedArgs,
        errors,
        // trace: this.tracer.currentTrace(),
      });
    }
  }

  throwSemanticFunctionError(message: string) {
    const errors = [{ message }];
    // this.tracer.push({
    //   type: 'error',
    //   errors,
    // });
    for (let callback of this.currentCallbacks) {
      callback.onSemanticSearchEnrichmentError(errors);
    }
    throw new SemanticFunctionError(message);
  }

}

export class FunctionEnrichment implements PromptEnrichmentStep {

  semanticFunction: SemanticFunction;
  modelKey: string;
  modelParams: ModelParams;
  contentPropertyPath: string;
  contextPropertyPath: string;
  callbacks: Callback[];
  currentCallbacks: Callback[];
  // tracer: Tracer;
  // startTime: Date;

  constructor({
    semanticFunction,
    modelKey,
    modelParams,
    contentPropertyPath,
    contextPropertyPath,
    callbacks,
  }: FunctionEnrichmentParams) {
    this.semanticFunction = semanticFunction;
    this.modelKey = modelKey;
    this.modelParams = modelParams;
    this.contentPropertyPath = contentPropertyPath;
    this.contextPropertyPath = contextPropertyPath;
    this.callbacks = callbacks || [];
    // this.tracer = new Tracer(this.getTraceName());
  }

  async call({ args, callbacks = [] }: PromptEnrichmentCallParams) {
    this.currentCallbacks = [...this.callbacks, ...callbacks];
    this.onStart({ args });
    try {
      const context = get(args, this.contextPropertyPath);
      const fnargs = set({}, this.contentPropertyPath, context);
      const response = await this.semanticFunction.call({
        args: fnargs,
        modelKey: this.modelKey,
        modelParams: this.modelParams,
        isBatch: false,
      });
      const enrichedArgs = set(clone(args), this.contextPropertyPath, response.choices[0].message.content);
      this.onEnd({ enrichedArgs });
      return enrichedArgs;
    } catch (err) {
      const errors = err.errors || [{ message: String(err) }];
      this.onEnd({ errors });
      throw err;
    }
  }

  getTraceName() {
    return [this.semanticFunction.name, new Date().toISOString()].join(' - ');
  }

  onStart({ args }: PromptEnrichmentCallParams) {
    // logger.info('start function enrichment', this.semanticFunction.name);
    // this.startTime = new Date();
    // this.tracer.push({
    //   type: 'function-enrichment',
    //   functionName: this.semanticFunction.name,
    //   modelKey: this.modelKey,
    //   modelParams: this.modelParams,
    //   contentPropertyPath: this.contentPropertyPath,
    //   contextPropertyPath: this.contextPropertyPath,
    //   args,
    //   startTime: this.startTime.getTime(),
    // });
    for (let callback of this.currentCallbacks) {
      callback.onFunctionEnrichmentStart({
        functionName: this.semanticFunction.name,
        modelKey: this.modelKey,
        modelParams: this.modelParams,
        contentPropertyPath: this.contentPropertyPath,
        contextPropertyPath: this.contextPropertyPath,
        args,
        // trace: this.tracer.currentTrace(),
      });
    }
    // this.tracer.down();
  }

  onEnd({ enrichedArgs, errors }: OnFunctionEnrichmentEndParams) {
    // logger.info('end function enrichment', this.semanticFunction.name);
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
    //     .addProperty('enrichedArgs', enrichedArgs)
    //     .addProperty('success', true)
    //     ;
    // }
    for (let callback of this.currentCallbacks) {
      callback.onFunctionEnrichmentEnd({
        functionName: this.semanticFunction.name,
        modelKey: this.modelKey,
        modelParams: this.modelParams,
        contentPropertyPath: this.contentPropertyPath,
        contextPropertyPath: this.contextPropertyPath,
        enrichedArgs,
        errors,
        // trace: this.tracer.currentTrace(),
      });
    }
  }

  throwSemanticFunctionError(message: string) {
    const errors = [{ message }];
    // this.tracer.push({
    //   type: 'error',
    //   errors,
    // });
    for (let callback of this.currentCallbacks) {
      callback.onFunctionEnrichmentError(errors);
    }
    throw new SemanticFunctionError(message);
  }

}

export class SqlEnrichment implements PromptEnrichmentStep {

  sqlSourceInfo: any;
  sqlSourceService: any;
  callbacks: Callback[];
  currentCallbacks: Callback[];
  // tracer: Tracer;
  // startTime: Date;

  constructor({
    sqlSourceInfo,
    sqlSourceService,
    callbacks,
  }: SqlEnrichmentParams) {
    this.sqlSourceInfo = sqlSourceInfo;
    this.sqlSourceService = sqlSourceService;
    this.callbacks = callbacks || [];
    // this.tracer = new Tracer(this.getTraceName());
  }

  async call({ args, callbacks = [] }: PromptEnrichmentCallParams) {
    this.currentCallbacks = [...this.callbacks, ...callbacks];
    this.onStart({ args });
    try {
      // const query = this.getQuery(args);
      let context;
      if (this.sqlSourceInfo.sqlType === 'schema') {
        context = await this.sqlSourceService.getSchema(this.sqlSourceInfo);
      } else if (this.sqlSourceInfo.sqlType === 'sample') {
        context = await this.sqlSourceService.getSample(this.sqlSourceInfo);
      }
      const enrichedArgs = this.enrich(args, context);
      this.onEnd({ enrichedArgs });
      return enrichedArgs;
    } catch (err) {
      const errors = err.errors || [{ message: String(err) }];
      this.onEnd({ errors });
      throw err;
    }
  }

  enrich(args: any, context: string) {
    // const contextPath = this.indexParams.indexContextPropertyPath || 'context';
    const contextPath = 'context';
    const existingContext = get(args, contextPath);
    if (existingContext) {
      if (typeof existingContext !== 'string') {
        this.throwSemanticFunctionError(`existing context found at ${contextPath} is an incompatible type`);
      }
      return set(clone(args), contextPath, [existingContext, context].join('\n\n'));
    }
    return set(clone(args), contextPath, context);
  }

  // getQuery(args: any) {
  //   const { allResults, indexContentPropertyPath } = this.indexParams;
  //   if (allResults) {
  //     return '*';
  //   }
  //   if (!indexContentPropertyPath || indexContentPropertyPath === 'root') {
  //     return args;
  //   }
  //   return get(args, indexContentPropertyPath);
  // }

  getTraceName() {
    return [this.sqlSourceInfo.databaseName, new Date().toISOString()].join(' - ');
  }

  onStart({ args }: PromptEnrichmentCallParams) {
    // logger.info('start enrichment from SQL');
    // this.startTime = new Date();
    // this.tracer.push({
    //   type: 'sql-enrichment',
    //   args,
    //   startTime: this.startTime.getTime(),
    // });
    for (let callback of this.currentCallbacks) {
      callback.onSqlEnrichmentStart({
        args,
        // trace: this.tracer.currentTrace(),
      });
    }
    // this.tracer.down();
  }

  onEnd({ enrichedArgs, errors }: OnSqlEnrichmentEndParams) {
    // logger.info('end enrichment from SQL');
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
    //     .addProperty('enrichedArgs', enrichedArgs)
    //     .addProperty('success', true)
    //     ;
    // }
    for (let callback of this.currentCallbacks) {
      callback.onSqlEnrichmentEnd({
        enrichedArgs,
        // trace: this.tracer.currentTrace(),
      });
    }
  }

  throwSemanticFunctionError(message: string) {
    const errors = [{ message }];
    // this.tracer.push({
    //   type: 'error',
    //   errors,
    // });
    for (let callback of this.currentCallbacks) {
      callback.onSqlEnrichmentError(errors);
    }
    throw new SemanticFunctionError(message);
  }

}

type PromptEnrichmentComponent = PromptEnrichmentStep | PromptEnrichmentStep[] | PromptTemplate;

interface PromptEnrichmentPipelineOptions {
  callbacks?: Callback[];
}

export const promptEnrichmentPipeline = (options: PromptEnrichmentPipelineOptions) => (...components: PromptEnrichmentComponent[]) => {
  const promptTemplate = components.pop();
  if (!(promptTemplate instanceof PromptTemplate)) {
    throw new Error('last component must be a PromptTemplate');
  }
  let steps: PromptEnrichmentStep[];
  if (Array.isArray(components[0])) {
    steps = components[0];
  } else {
    steps = components as PromptEnrichmentStep[];
  }
  return new PromptEnrichmentPipeline({
    ...options,
    promptTemplate,
    steps
  });
}

interface FeatureStoreEnrichmentOptions {
  featureStoreService: any;
  featurestore: string;
  featureStoreParams: FeatureStoreParams;
  callbacks?: Callback[];
}

export const featureStoreEnrichment = (options: FeatureStoreEnrichmentOptions) => {
  return new FeatureStoreEnrichment(options);
}

interface SemanticSearchEnrichmentOptions {
  indexName: string;
  indexParams: IndexParams;
  searchService: any;
  callbacks?: Callback[];
}

export const semanticSearchEnrichment = (options: SemanticSearchEnrichmentOptions) => {
  return new SemanticSearchEnrichment(options);
}

interface FunctionEnrichmentOptions {
  semanticFunction: SemanticFunction;
  modelKey: string;
  modelParams: ModelParams;
  contentPropertyPath: string;
  contextPropertyPath: string;
  callbacks?: Callback[];
}

export const functionEnrichment = (options: FunctionEnrichmentOptions) => {
  return new FunctionEnrichment(options);
}

interface SqlEnrichmentOptions {
  sqlSourceInfo: any;
  sqlSourceService: any;
  callbacks?: Callback[];
}

export const sqlEnrichment = (options: SqlEnrichmentOptions) => {
  return new SqlEnrichment(options);
}
