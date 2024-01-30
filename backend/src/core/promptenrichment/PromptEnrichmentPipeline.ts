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

  async call({ args, messages, contextWindow, maxTokens, modelKey, isBatch, callbacks = [] }: PromptEnrichmentCallParams) {
    this.currentCallbacks = [...this.callbacks, ...callbacks];
    this.onStart({ args, isBatch, contextWindow, modelKey });
    try {
      const costComponents = [];
      let totalCost = 0;
      let promptTokens = 0;
      let completionTokens = 0;
      let totalTokens = 0;
      for (const step of this.steps) {
        const res = await step.call({ args, isBatch, callbacks });
        args = res.args;
        const responseMetadata = res.responseMetadata;
        if (responseMetadata) {
          costComponents.push(...(responseMetadata.costComponents || []));
          totalCost += responseMetadata.totalCost || 0;
          promptTokens += responseMetadata.promptTokens || 0;
          completionTokens += responseMetadata.completionTokens || 0;
          totalTokens += responseMetadata.totalTokens || 0;
        }
      }
      const responseMetadata = {
        totalCost,
        costComponents,
        promptTokens,
        completionTokens,
        totalTokens,
      };
      const prompts = await this.promptTemplate.call({ args, messages, contextWindow, maxTokens, modelKey, isBatch, callbacks });
      this.onEnd({ messages: await convertMessagesWithImages(prompts) });

      return {
        messages: prompts,
        responseMetadata,
      };
    } catch (err) {
      const errors = err.errors || [{ message: String(err) }];
      this.onEnd({ errors });
      throw err;
    }
  }

  onStart({ args, isBatch }: PromptEnrichmentCallParams) {
    for (let callback of this.currentCallbacks) {
      callback.onPromptEnrichmentStart({
        args,
        isBatch,
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

  async call({ args, isBatch, callbacks }: PromptEnrichmentCallParams) {
    this.currentCallbacks = [...this.callbacks, ...callbacks];
    this.onStart({ args, isBatch });
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
      return { args: enrichedArgs };
    } catch (err) {
      const errors = err.errors || [{ message: String(err) }];
      this.onEnd({ errors });
      throw err;
    }
  }

  onStart({ args, isBatch }: PromptEnrichmentCallParams) {
    for (let callback of this.currentCallbacks) {
      callback.onFeatureStoreEnrichmentStart({
        featureStore: {
          name: this.featurestore,
          params: this.featureStoreParams,
        },
        args,
        isBatch,
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
  rerankerModel: any;
  callbacks: Callback[];
  currentCallbacks: Callback[];

  constructor({
    indexName,
    indexParams,
    llmService,
    vectorStoreService,
    rerankerModel,
    callbacks,
  }: SearchIndexEnrichmentParams) {
    this.indexName = indexName;
    this.indexParams = indexParams;
    this.llmService = llmService;
    this.vectorStoreService = vectorStoreService;
    this.rerankerModel = rerankerModel;
    this.callbacks = callbacks || [];
  }

  async call({ args, isBatch, callbacks = [] }: PromptEnrichmentCallParams) {
    this.currentCallbacks = [...this.callbacks, ...callbacks];
    this.onStart({ args, isBatch });
    try {
      const query = this.getQuery(args);
      const { nodeLabel, embeddingModel, vectorStoreProvider } = this.indexParams;
      if (!vectorStoreProvider) {
        throw new Error('Only vector stores currently support search');
      }
      let queryEmbedding: number[];
      if (vectorStoreProvider !== 'redis' && vectorStoreProvider !== 'elasticsearch') {
        const { provider, model } = embeddingModel;
        const response = await this.llmService.createEmbedding(provider, { input: query, model });
        queryEmbedding = response.data[0].embedding;
      }
      const results = await this.vectorStoreService.search(
        vectorStoreProvider,
        this.indexName,
        query,
        null,  // attrs
        null,  // logicalType
        { k: 10, queryEmbedding, nodeLabel }  // params
      );
      logger.debug('results:', results);

      let hits = [];
      let enrichedArgs: any;
      if (results.length) {
        hits = results
          .map((val: any) => Object.entries(val).reduce((a, [k, v]) => {
            const key = k.replace(/__/g, '.');
            a[key] = v;
            return a;
          }, {}));
        hits = hits.map(hit => unflatten(hit));
        hits = hits.map((val: any) => {
          if (val.dist) {
            return {
              ...val[nodeLabel],
              dist: parseFloat(val.dist),
            };
          } else {
            return {
              ...val[nodeLabel],
              score: parseFloat(val.score),
            };
          }
        });
        const isDistMetric = 'dist' in hits[0];
        if (isDistMetric) {
          hits.sort((a, b) => a.dist < b.dist ? -1 : 1);
        } else {
          hits.sort((a, b) => a.score > b.score ? -1 : 1);
        }
        logger.debug('hits:', hits);

        if (this.rerankerModel) {
          const { model, provider } = this.rerankerModel;
          const rerank = await this.llmService.rerank(
            provider,
            model,
            hits.map((h: any) => h.text),
            query,
            3,
          );
          logger.debug('rerank:', rerank);
          const ranked = [];
          for (const result of rerank.results) {
            ranked.push({
              ...hits[result.index],
              rerankerScore: result.relevanceScore,
            });
          }
          hits = ranked;
          logger.debug('ranked:', ranked);
        }

        const getHitText = this.getHitText.bind(this);
        const contextLines = hits.map(getHitText);
        logger.debug('contextLines:', contextLines);

        const context = contextLines.join('\n\n');

        enrichedArgs = this.enrich(args, context);
      } else {
        enrichedArgs = args;
      }

      this.onEnd({ enrichedArgs });

      return { args: enrichedArgs };

    } catch (err) {
      const errors = err.errors || [{ message: String(err) }];
      this.onEnd({ errors });
      throw err;
    }
  }

  getCitationSource(metadata: any) {
    if (!metadata) return null;
    return metadata.objectName || metadata.endpoint || metadata.database;
  }

  getHitText({ metadata, text }) {
    let result = `Context:\n***${text}***`;
    const citation = this.getCitationSource(metadata);
    if (citation) {
      result += `\nCitation: {"source": "${citation}"`;
      if (metadata.page) {
        result += `, "page": ${metadata.page}`;
      }
      if (metadata.row) {
        result += `, "row": ${metadata.row}`;
      }
      if (metadata.dataSourceId) {
        result += `, "dataSourceId": ${metadata.dataSourceId}`;
      }
      if (metadata.dataSourceName) {
        result += `, "dataSourceName": ${metadata.dataSourceName}`;
      }
      result += '}';
    }
    return result;
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

  onStart({ args, isBatch }: PromptEnrichmentCallParams) {
    for (let callback of this.currentCallbacks) {
      callback.onSemanticSearchEnrichmentStart({
        index: {
          name: this.indexName,
          params: this.indexParams,
        },
        args,
        isBatch,
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
  modelParams: Partial<ModelParams>;
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

  async call({ args, isBatch, callbacks = [] }: PromptEnrichmentCallParams) {
    this.currentCallbacks = [...this.callbacks, ...callbacks];
    this.onStart({ args, isBatch });
    try {
      const context = get(args, this.contextPropertyPath);
      const fnargs = set({}, this.contentPropertyPath, context);
      const { response, responseMetadata } = await this.semanticFunction.call({
        args: fnargs,
        modelKey: this.modelKey,
        modelParams: this.modelParams,
        isBatch: false,
      });
      // TODO - assumes content response, not function call
      const enrichedArgs = set(clone(args), this.contextPropertyPath, response.choices[0].message.content);
      this.onEnd({ enrichedArgs });

      return {
        args: enrichedArgs,
        responseMetadata,
      };

    } catch (err) {
      const errors = err.errors || [{ message: String(err) }];
      this.onEnd({ errors });
      throw err;
    }
  }

  onStart({ args, isBatch }: PromptEnrichmentCallParams) {
    for (let callback of this.currentCallbacks) {
      callback.onFunctionEnrichmentStart({
        functionName: this.semanticFunction.name,
        modelKey: this.modelKey,
        modelParams: this.modelParams,
        contentPropertyPath: this.contentPropertyPath,
        contextPropertyPath: this.contextPropertyPath,
        args,
        isBatch,
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

  async call({ args, isBatch, callbacks = [] }: PromptEnrichmentCallParams) {
    this.currentCallbacks = [...this.callbacks, ...callbacks];
    this.onStart({ args, isBatch });
    try {
      let context: string;
      if (this.sqlSourceInfo.sqlType === 'schema') {
        context = await this.sqlSourceService.getDDL(this.sqlSourceInfo);
      } else if (this.sqlSourceInfo.sqlType === 'sample') {
        context = await this.sqlSourceService.getSample(this.sqlSourceInfo);
      }
      const enrichedArgs = this.enrich(args, context);
      this.onEnd({ enrichedArgs });
      return { args: enrichedArgs };
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

  onStart({ args, isBatch }: PromptEnrichmentCallParams) {
    for (let callback of this.currentCallbacks) {
      callback.onSqlEnrichmentStart({
        args,
        isBatch,
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

  async call({ args, isBatch, callbacks = [] }: PromptEnrichmentCallParams) {
    this.currentCallbacks = [...this.callbacks, ...callbacks];
    this.onStart({ args, isBatch });
    try {
      const { graphstore, nodeLabel } = this.graphSourceInfo;
      const schema = await this.graphStoreService.getSchema(graphstore, { nodeLabel });
      const context = getSchemaAsText(schema);
      const enrichedArgs = this.enrich(args, context);
      this.onEnd({ enrichedArgs });
      return { args: enrichedArgs };
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

  onStart({ args, isBatch }: PromptEnrichmentCallParams) {
    for (let callback of this.currentCallbacks) {
      callback.onGraphEnrichmentStart({
        args,
        isBatch,
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
  rerankerModel: any;
  callbacks?: Callback[];
}

export const semanticSearchEnrichment = (options: SemanticSearchEnrichmentOptions) => {
  return new SemanticSearchEnrichment(options);
}

interface FunctionEnrichmentOptions {
  semanticFunction: SemanticFunction;
  modelKey: string;
  modelParams: Partial<ModelParams>;
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
