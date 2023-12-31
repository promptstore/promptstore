import relativeTime from 'dayjs/plugin/relativeTime';
import clone from 'lodash.clonedeep';
import get from 'lodash.get';
import set from 'lodash.set';  // mutable
import { default as dayjs } from 'dayjs';
import { unflatten } from 'flat';

import logger from '../../logger';
import { Callback } from '../callbacks/Callback';
import { ModelParams } from '../conversions/RosettaStone';
import { SemanticFunctionError } from '../errors';
import { GraphStoreService } from '../indexers/GraphStore';
import { LLMService } from '../models/llm_types';
import { SemanticFunction } from '../semanticfunctions/SemanticFunction';
import { convertMessagesWithImages } from '../utils';
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
  GraphEnrichmentParams,
  OnGraphEnrichmentEndParams,
} from './PromptEnrichmentPipeline_types';
import { PromptTemplate } from './PromptTemplate';

dayjs.extend(relativeTime);

export class PromptEnrichmentPipeline {

  promptTemplate: PromptTemplate;
  steps: PromptEnrichmentStep[];
  callbacks: Callback[];
  currentCallbacks: Callback[];

  constructor({
    promptTemplate,
    steps,
    callbacks,
  }: PromptEnrichmentPipelineParams) {
    this.promptTemplate = promptTemplate;
    this.steps = steps;
    this.callbacks = callbacks || [];
  }

  async call({ args, contextWindow, maxTokens, modelKey, callbacks = [] }: PromptEnrichmentCallParams) {
    this.currentCallbacks = [...this.callbacks, ...callbacks];
    this.onStart({ args, contextWindow, modelKey });
    try {
      for (const step of this.steps) {
        args = await step.call({ args, callbacks });
      }
      const messages = await this.promptTemplate.call({ args, contextWindow, maxTokens, modelKey, callbacks });
      this.onEnd({ messages: await convertMessagesWithImages(messages) });
      return messages;
    } catch (err) {
      const errors = err.errors || [{ message: String(err) }];
      this.onEnd({ errors });
      throw err;
    }
  }

  onStart({ args }: PromptEnrichmentCallParams) {
    for (let callback of this.currentCallbacks) {
      callback.onPromptEnrichmentStart({
        args,
      });
    }
  }

  onEnd({ messages, errors }: PromptEnrichmentOnEndParams) {
    for (let callback of this.currentCallbacks) {
      callback.onPromptEnrichmentEnd({
        messages,
        errors,
      });
    }
  }

  throwSemanticFunctionError(message: string) {
    const errors = [{ message }];
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

  onStart({ args }: PromptEnrichmentCallParams) {
    for (let callback of this.currentCallbacks) {
      callback.onFeatureStoreEnrichmentStart({
        featureStore: {
          name: this.featurestore,
          params: this.featureStoreParams,
        },
        args,
      });
    }
  }

  onEnd({ enrichedArgs, errors }: OnFeatureStoreEnrichmentEndParams) {
    for (let callback of this.currentCallbacks) {
      callback.onFeatureStoreEnrichmentEnd({
        featureStore: {
          name: this.featurestore,
          params: this.featureStoreParams,
        },
        enrichedArgs,
        errors,
      });
    }
  }

  throwSemanticFunctionError(message: string) {
    const errors = [{ message }];
    for (let callback of this.currentCallbacks) {
      callback.onFeatureStoreEnrichmentError(errors);
    }
    throw new SemanticFunctionError(message);
  }

}

export class SemanticSearchEnrichment implements PromptEnrichmentStep {

  indexName: string;
  indexParams: IndexParams;
  llmService: LLMService;
  vectorStoreService: any;
  callbacks: Callback[];
  currentCallbacks: Callback[];

  constructor({
    indexName,
    indexParams,
    llmService,
    vectorStoreService,
    callbacks,
  }: SearchIndexEnrichmentParams) {
    this.indexName = indexName;
    this.indexParams = indexParams;
    this.llmService = llmService;
    this.vectorStoreService = vectorStoreService;
    this.callbacks = callbacks || [];
  }

  async call({ args, callbacks = [] }: PromptEnrichmentCallParams) {
    this.currentCallbacks = [...this.callbacks, ...callbacks];
    this.onStart({ args });
    try {
      const query = this.getQuery(args);
      const { nodeLabel, embeddingProvider, vectorStoreProvider } = this.indexParams;

      // TODO `queryEmbedding` not required if using redis
      const { embedding: queryEmbedding } =
        await this.llmService.createEmbedding(embeddingProvider, { input: query });
      const results = await this.vectorStoreService.search(
        vectorStoreProvider,
        this.indexName,
        query,
        null,
        { k: 5, queryEmbedding }
      );
      logger.debug('results:', results);

      let hits = results
        .map((val: any) => Object.entries(val).reduce((a, [k, v]) => {
          const key = k.replace(/__/g, '.');
          a[key] = v;
          return a;
        }, {}))
      hits = hits.map(unflatten);
      hits = hits.map((val: any) => {
        if (val.dist) {
          return {
            ...val[nodeLabel],
            dist: val.dist,
          };
        } else {
          return {
            ...val[nodeLabel],
            score: parseFloat(val.score),
          };
        }
      });
      const contextLines = hits.map(this.getHitText);
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

  getHitText({ metadata, text }) {
    if (metadata?.filename) {
      text += `\nCitation: ${metadata.filename}, page: ${metadata.page}`;
    }
    return text;
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

  onStart({ args }: PromptEnrichmentCallParams) {
    for (let callback of this.currentCallbacks) {
      callback.onSemanticSearchEnrichmentStart({
        index: {
          name: this.indexName,
          params: this.indexParams,
        },
        args,
      });
    }
  }

  onEnd({ enrichedArgs, errors }: OnSemanticSearchEnrichmentEndParams) {
    for (let callback of this.currentCallbacks) {
      callback.onSemanticSearchEnrichmentEnd({
        index: {
          name: this.indexName,
          params: this.indexParams,
        },
        enrichedArgs,
        errors,
      });
    }
  }

  throwSemanticFunctionError(message: string) {
    const errors = [{ message }];
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
  }

  async call({ args, callbacks = [] }: PromptEnrichmentCallParams) {
    this.currentCallbacks = [...this.callbacks, ...callbacks];
    this.onStart({ args });
    try {
      const context = get(args, this.contextPropertyPath);
      const fnargs = set({}, this.contentPropertyPath, context);
      const { response } = await this.semanticFunction.call({
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

  onStart({ args }: PromptEnrichmentCallParams) {
    for (let callback of this.currentCallbacks) {
      callback.onFunctionEnrichmentStart({
        functionName: this.semanticFunction.name,
        modelKey: this.modelKey,
        modelParams: this.modelParams,
        contentPropertyPath: this.contentPropertyPath,
        contextPropertyPath: this.contextPropertyPath,
        args,
      });
    }
  }

  onEnd({ enrichedArgs, errors }: OnFunctionEnrichmentEndParams) {
    for (let callback of this.currentCallbacks) {
      callback.onFunctionEnrichmentEnd({
        functionName: this.semanticFunction.name,
        modelKey: this.modelKey,
        modelParams: this.modelParams,
        contentPropertyPath: this.contentPropertyPath,
        contextPropertyPath: this.contextPropertyPath,
        enrichedArgs,
        errors,
      });
    }
  }

  throwSemanticFunctionError(message: string) {
    const errors = [{ message }];
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

  constructor({
    sqlSourceInfo,
    sqlSourceService,
    callbacks,
  }: SqlEnrichmentParams) {
    this.sqlSourceInfo = sqlSourceInfo;
    this.sqlSourceService = sqlSourceService;
    this.callbacks = callbacks || [];
  }

  async call({ args, callbacks = [] }: PromptEnrichmentCallParams) {
    this.currentCallbacks = [...this.callbacks, ...callbacks];
    this.onStart({ args });
    try {
      let context: string;
      if (this.sqlSourceInfo.sqlType === 'schema') {
        context = await this.sqlSourceService.getDDL(this.sqlSourceInfo);
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

  onStart({ args }: PromptEnrichmentCallParams) {
    for (let callback of this.currentCallbacks) {
      callback.onSqlEnrichmentStart({
        args,
      });
    }
  }

  onEnd({ enrichedArgs, errors }: OnSqlEnrichmentEndParams) {
    for (let callback of this.currentCallbacks) {
      callback.onSqlEnrichmentEnd({
        enrichedArgs,
      });
    }
  }

  throwSemanticFunctionError(message: string) {
    const errors = [{ message }];
    for (let callback of this.currentCallbacks) {
      callback.onSqlEnrichmentError(errors);
    }
    throw new SemanticFunctionError(message);
  }

}

export class KnowledgeGraphEnrichment implements PromptEnrichmentStep {

  graphSourceInfo: any;
  graphStoreService: any;
  callbacks: Callback[];
  currentCallbacks: Callback[];

  constructor({
    graphSourceInfo,
    graphStoreService,
    callbacks,
  }: GraphEnrichmentParams) {
    this.graphSourceInfo = graphSourceInfo;
    this.graphStoreService = graphStoreService;
    this.callbacks = callbacks || [];
  }

  async call({ args, callbacks = [] }: PromptEnrichmentCallParams) {
    this.currentCallbacks = [...this.callbacks, ...callbacks];
    this.onStart({ args });
    try {
      const { graphstore, nodeLabel } = this.graphSourceInfo;
      const schema = await this.graphStoreService.getSchema(graphstore, { nodeLabel });
      const context = getSchemaAsText(schema);
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

  onStart({ args }: PromptEnrichmentCallParams) {
    for (let callback of this.currentCallbacks) {
      callback.onGraphEnrichmentStart({
        args,
      });
    }
  }

  onEnd({ enrichedArgs, errors }: OnGraphEnrichmentEndParams) {
    for (let callback of this.currentCallbacks) {
      callback.onGraphEnrichmentEnd({
        enrichedArgs,
      });
    }
  }

  throwSemanticFunctionError(message: string) {
    const errors = [{ message }];
    for (let callback of this.currentCallbacks) {
      callback.onGraphEnrichmentError(errors);
    }
    throw new SemanticFunctionError(message);
  }

}

function getSchemaAsText(schema: any) {
  return 'Node properties are the following:\n' +
    JSON.stringify(schema.node_properties, null, 2) + '\n\n' +
    'Relationship properties are the following:\n' +
    JSON.stringify(schema.relationship_properties, null, 2) + '\n\n' +
    'The relationships are the following:\n' +
    schema.relationships.map((r: any) =>
      `(:${r.start})-[:${r.type}]-(:${r.end})`
    ).join('\n')
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
  llmService: LLMService;
  vectorStoreService: any;
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

interface KnowledgeGraphEnrichmentOptions {
  graphSourceInfo: any;
  graphStoreService: GraphStoreService;
  callbacks?: Callback[];
}

export const knowledgeGraphEnrichment = (options: KnowledgeGraphEnrichmentOptions) => {
  return new KnowledgeGraphEnrichment(options);
}
