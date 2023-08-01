import * as dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import get from 'lodash.get';
import set from 'lodash.set';

import logger from '../logger';

import { SemanticFunctionError } from './errors';
import { ModelParams } from './Model_types';
import {
  PromptEnrichmentPipelineParams,
  PromptEnrichmentStep,
  PromptEnrichmentCallParams,
  OnPromptEnrichmentEndParams,
  OnPromptEnrichmentStartCallbackFunction,
  OnPromptEnrichmentEndCallbackFunction,
  OnPromptEnrichmentErrorCallbackFunction,
  FeatureStoreEnrichmentParams,
  FeatureStoreParams,
  OnFeatureStoreEnrichmentEndParams,
  OnFeatureStoreEnrichmentStartCallbackFunction,
  OnFeatureStoreEnrichmentEndCallbackFunction,
  OnFeatureStoreEnrichmentErrorCallbackFunction,
  SearchIndexEnrichmentParams,
  IndexParams,
  OnSemanticSearchEnrichmentEndParams,
  OnSemanticSearchEnrichmentStartCallbackFunction,
  OnSemanticSearchEnrichmentEndCallbackFunction,
  OnSemanticSearchEnrichmentErrorCallbackFunction,
  FunctionEnrichmentParams,
  OnFunctionEnrichmentEndParams,
  OnFunctionEnrichmentStartCallbackFunction,
  OnFunctionEnrichmentEndCallbackFunction,
  OnFunctionEnrichmentErrorCallbackFunction,
} from './PromptEnrichmentPipeline_types';
import { PromptTemplate } from './PromptTemplate';
import { SemanticFunction } from './SemanticFunction';
import { Tracer } from './Tracer';

dayjs.extend(relativeTime);

export class PromptEnrichmentPipeline {

  promptTemplate: PromptTemplate;
  steps: PromptEnrichmentStep[];
  tracer: Tracer;
  onPromptEnrichmentStart?: OnPromptEnrichmentStartCallbackFunction;
  onPromptEnrichmentEnd?: OnPromptEnrichmentEndCallbackFunction;
  onPromptEnrichmentError?: OnPromptEnrichmentErrorCallbackFunction;
  startTime: Date;

  constructor({
    promptTemplate,
    steps,
    onPromptEnrichmentStart,
    onPromptEnrichmentEnd,
    onPromptEnrichmentError,
  }: PromptEnrichmentPipelineParams) {
    this.promptTemplate = promptTemplate;
    this.steps = steps;
    this.tracer = new Tracer(this.getTraceName());
    this.onPromptEnrichmentStart = onPromptEnrichmentStart;
    this.onPromptEnrichmentEnd = onPromptEnrichmentEnd;
    this.onPromptEnrichmentError = onPromptEnrichmentError;
  }

  async call({ args }: PromptEnrichmentCallParams) {
    this.onStart({ args });
    for (const step of this.steps) {
      args = await step.call({ args })
    }
    const messages = this.promptTemplate.call({ args });
    this.onEnd({ messages });
    return messages;
  }

  getTraceName() {
    return ['prompt-enrichment-pipeline', new Date().toISOString()].join(' - ');
  }

  onStart({ args }: PromptEnrichmentCallParams) {
    logger.info('start enrichment pipeline');
    this.startTime = new Date();
    this.tracer.push({
      type: 'enrichment-pipeline',
      args,
      startTime: this.startTime.getTime(),
    });
    if (this.onPromptEnrichmentStart) {
      this.onPromptEnrichmentStart({
        args,
        trace: this.tracer.currentTrace(),
      });
    }
  }

  onEnd({ messages }: OnPromptEnrichmentEndParams) {
    logger.info('start enrichment pipeline');
    const endTime = new Date();
    this.tracer
      .addProperty('messages', messages)
      .addProperty('endTime', endTime.getTime())
      .addProperty('elapsedMillis', endTime.getTime() - this.startTime.getTime())
      .addProperty('elapsedReadable', dayjs(endTime).from(this.startTime))
      .addProperty('success', true);
    if (this.onPromptEnrichmentEnd) {
      this.onPromptEnrichmentEnd({
        messages,
        trace: this.tracer.currentTrace(),
      });
    }
  }

  throwSemanticFunctionError(message: string) {
    const errors = [{ message }];
    this.tracer.push({
      type: 'error',
      errors,
    });
    if (this.onPromptEnrichmentError) {
      this.onPromptEnrichmentError(errors);
    }
    throw new SemanticFunctionError(message);
  }

}

export class FeatureStoreEnrichment implements PromptEnrichmentStep {

  featurestore: string;
  featureStoreParams: FeatureStoreParams;
  featureStoreService: any;
  tracer: Tracer;
  onFeatureStoreEnrichmentStart?: OnFeatureStoreEnrichmentStartCallbackFunction;
  onFeatureStoreEnrichmentEnd?: OnFeatureStoreEnrichmentEndCallbackFunction;
  onFeatureStoreEnrichmentError?: OnFeatureStoreEnrichmentErrorCallbackFunction;
  startTime: Date;

  constructor({
    featurestore,
    featureStoreParams,
    featureStoreService,
    onFeatureStoreEnrichmentStart,
    onFeatureStoreEnrichmentEnd,
    onFeatureStoreEnrichmentError,
  }: FeatureStoreEnrichmentParams) {
    this.featurestore = featurestore;
    this.featureStoreParams = featureStoreParams;
    this.featureStoreService = featureStoreService;
    this.tracer = new Tracer(this.getTraceName());
    this.onFeatureStoreEnrichmentStart = onFeatureStoreEnrichmentStart;
    this.onFeatureStoreEnrichmentEnd = onFeatureStoreEnrichmentEnd;
    this.onFeatureStoreEnrichmentError = onFeatureStoreEnrichmentError;
  }

  async call(args: any) {
    this.onStart({ args });
    const values = await this.featureStoreService.getOnlineFeatures(
      this.featurestore,
      this.featureStoreParams,
      args.entityId
    );
    args = {
      ...args,
      ...values
    };
    this.onEnd({ args });
    return args;
  }

  getTraceName() {
    return [this.featurestore, new Date().toISOString()].join(' - ');
  }

  onStart({ args }: PromptEnrichmentCallParams) {
    logger.info('start enrichment from feature store', this.featurestore);
    this.startTime = new Date();
    this.tracer.push({
      type: 'feature-store-enrichment',
      featureStore: {
        name: this.featurestore,
        params: this.featureStoreParams,
      },
      args,
      startTime: this.startTime.getTime(),
    });
    if (this.onFeatureStoreEnrichmentStart) {
      this.onFeatureStoreEnrichmentStart({
        featureStore: {
          name: this.featurestore,
          params: this.featureStoreParams,
        },
        args,
        trace: this.tracer.currentTrace(),
      });
    }
  }

  onEnd({ args }: OnFeatureStoreEnrichmentEndParams) {
    logger.info('end enrichment from feature store', this.featurestore);
    const endTime = new Date();
    this.tracer
      .addProperty('enrichedArgs', args)
      .addProperty('endTime', endTime.getTime())
      .addProperty('elapsedMillis', endTime.getTime() - this.startTime.getTime())
      .addProperty('elapsedReadable', dayjs(endTime).from(this.startTime))
      .addProperty('success', true);
    if (this.onFeatureStoreEnrichmentEnd) {
      this.onFeatureStoreEnrichmentEnd({
        featureStore: {
          name: this.featurestore,
          params: this.featureStoreParams,
        },
        args,
        trace: this.tracer.currentTrace(),
      });
    }
  }

  throwSemanticFunctionError(message: string) {
    const errors = [{ message }];
    this.tracer.push({
      type: 'error',
      errors,
    });
    if (this.onFeatureStoreEnrichmentError) {
      this.onFeatureStoreEnrichmentError(errors);
    }
    throw new SemanticFunctionError(message);
  }

}

export class SemanticSearchEnrichment implements PromptEnrichmentStep {

  indexName: string;
  indexParams: IndexParams;
  searchService: any;
  tracer: Tracer;
  onSemanticSearchEnrichmentStart?: OnSemanticSearchEnrichmentStartCallbackFunction;
  onSemanticSearchEnrichmentEnd?: OnSemanticSearchEnrichmentEndCallbackFunction;
  onSemanticSearchEnrichmentError?: OnSemanticSearchEnrichmentErrorCallbackFunction;
  startTime: Date;

  constructor({
    indexName,
    indexParams,
    searchService,
    onSemanticSearchEnrichmentStart,
    onSemanticSearchEnrichmentEnd,
    onSemanticSearchEnrichmentError,
  }: SearchIndexEnrichmentParams) {
    this.indexName = indexName;
    this.indexParams = indexParams;
    this.searchService = searchService;
    this.tracer = new Tracer(this.getTraceName());
    this.onSemanticSearchEnrichmentStart = onSemanticSearchEnrichmentStart;
    this.onSemanticSearchEnrichmentEnd = onSemanticSearchEnrichmentEnd;
    this.onSemanticSearchEnrichmentError = onSemanticSearchEnrichmentError;
  }

  async call({ args }: PromptEnrichmentCallParams) {
    this.onStart({ args });
    const query = this.getQuery(args);
    const results = await this.searchService.search(this.indexName, query);
    const contextLines = results.map((r: any) => r.content_text);
    const context = contextLines.join('\n\n');
    args = this.enrich(args, context);
    this.onEnd({ args });
    return args;
  }

  enrich(args: any, context: string) {
    const contextPath = this.indexParams.indexContextPropertyPath || 'context';
    const existingContext = get(args, contextPath);
    if (existingContext) {
      if (typeof existingContext !== 'string') {
        this.throwSemanticFunctionError(`existing context found at ${contextPath} is an incompatible type`);
      }
      return set(args, contextPath, [existingContext, context].join('\n\n'));
    }
    return set(args, contextPath, context);
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
    logger.info('start enrichment from index', this.indexName);
    this.startTime = new Date();
    this.tracer.push({
      type: 'semantic-search-enrichment',
      index: {
        name: this.indexName,
        params: this.indexParams,
      },
      args,
      startTime: this.startTime.getTime(),
    });
    if (this.onSemanticSearchEnrichmentStart) {
      this.onSemanticSearchEnrichmentStart({
        index: {
          name: this.indexName,
          params: this.indexParams,
        },
        args,
        trace: this.tracer.currentTrace(),
      });
    }
  }

  onEnd({ args }: OnSemanticSearchEnrichmentEndParams) {
    logger.info('end enrichment from index', this.indexName);
    const endTime = new Date();
    this.tracer
      .addProperty('enrichedArgs', args)
      .addProperty('endTime', endTime.getTime())
      .addProperty('elapsedMillis', endTime.getTime() - this.startTime.getTime())
      .addProperty('elapsedReadable', dayjs(endTime).from(this.startTime))
      .addProperty('success', true);
    if (this.onSemanticSearchEnrichmentEnd) {
      this.onSemanticSearchEnrichmentEnd({
        index: {
          name: this.indexName,
          params: this.indexParams,
        },
        args,
        trace: this.tracer.currentTrace(),
      });
    }
  }

  throwSemanticFunctionError(message: string) {
    const errors = [{ message }];
    this.tracer.push({
      type: 'error',
      errors,
    });
    if (this.onSemanticSearchEnrichmentError) {
      this.onSemanticSearchEnrichmentError(errors);
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
  tracer: Tracer;
  onFunctionEnrichmentStart?: OnFunctionEnrichmentStartCallbackFunction;
  onFunctionEnrichmentEnd?: OnFunctionEnrichmentEndCallbackFunction;
  onFunctionEnrichmentError?: OnFunctionEnrichmentErrorCallbackFunction;
  startTime: Date;

  constructor({
    semanticFunction,
    modelKey,
    modelParams,
    contentPropertyPath,
    contextPropertyPath,
    onFunctionEnrichmentStart,
    onFunctionEnrichmentEnd,
    onFunctionEnrichmentError,
  }: FunctionEnrichmentParams) {
    this.semanticFunction = semanticFunction;
    this.modelKey = modelKey;
    this.modelParams = modelParams;
    this.contentPropertyPath = contentPropertyPath;
    this.contextPropertyPath = contextPropertyPath;
    this.tracer = new Tracer(this.getTraceName());
    this.onFunctionEnrichmentStart = onFunctionEnrichmentStart;
    this.onFunctionEnrichmentEnd = onFunctionEnrichmentEnd;
    this.onFunctionEnrichmentError = onFunctionEnrichmentError;
  }

  async call(args: any) {
    this.onStart({ args });
    const context = get(args, this.contextPropertyPath);
    const fnargs = set({}, this.contentPropertyPath, context);
    const response = await this.semanticFunction.call({
      args: fnargs,
      modelKey: this.modelKey,
      modelParams: this.modelParams,
      isBatch: false,
    });
    args = set(args, this.contextPropertyPath, response.choices[0].message.content);
    this.onEnd({ args });
    return args;
  }

  getTraceName() {
    return [this.semanticFunction.name, new Date().toISOString()].join(' - ');
  }

  onStart({ args }: PromptEnrichmentCallParams) {
    logger.info('start function enrichment', this.semanticFunction.name);
    this.startTime = new Date();
    this.tracer.push({
      type: 'function-enrichment',
      functionName: this.semanticFunction.name,
      modelKey: this.modelKey,
      modelParams: this.modelParams,
      contentPropertyPath: this.contentPropertyPath,
      contextPropertyPath: this.contextPropertyPath,
      args,
      startTime: this.startTime.getTime(),
    });
    if (this.onFunctionEnrichmentStart) {
      this.onFunctionEnrichmentStart({
        functionName: this.semanticFunction.name,
        modelKey: this.modelKey,
        modelParams: this.modelParams,
        contentPropertyPath: this.contentPropertyPath,
        contextPropertyPath: this.contextPropertyPath,
        args,
        trace: this.tracer.currentTrace(),
      });
    }
  }

  onEnd({ args }: OnFunctionEnrichmentEndParams) {
    logger.info('end function enrichment', this.semanticFunction.name);
    const endTime = new Date();
    this.tracer
      .addProperty('enrichedArgs', args)
      .addProperty('endTime', endTime.getTime())
      .addProperty('elapsedMillis', endTime.getTime() - this.startTime.getTime())
      .addProperty('elapsedReadable', dayjs(endTime).from(this.startTime))
      .addProperty('success', true);
    if (this.onFunctionEnrichmentEnd) {
      this.onFunctionEnrichmentEnd({
        functionName: this.semanticFunction.name,
        modelKey: this.modelKey,
        modelParams: this.modelParams,
        contentPropertyPath: this.contentPropertyPath,
        contextPropertyPath: this.contextPropertyPath,
        args,
        trace: this.tracer.currentTrace(),
      });
    }
  }

  throwSemanticFunctionError(message: string) {
    const errors = [{ message }];
    this.tracer.push({
      type: 'error',
      errors,
    });
    if (this.onFunctionEnrichmentError) {
      this.onFunctionEnrichmentError(errors);
    }
    throw new SemanticFunctionError(message);
  }

}
