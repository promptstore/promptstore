import { ChatCompletionService, ModelParams } from './Model_types';
import { LLMChatModel } from './Model';
import { PromptEnrichmentStep } from './PromptEnrichmentPipeline_types';
import {
  FeatureStoreEnrichment,
  FunctionEnrichment,
  PromptEnrichmentPipeline,
  SemanticSearchEnrichment,
} from './PromptEnrichmentPipeline';
import { PromptTemplate, message } from './PromptTemplate';
import { SemanticFunction } from './SemanticFunction';
import { SemanticFunctionImplementation } from './SemanticFunctionImplementation';

import logger from '../logger';

interface LocalExecutorParams {
  dataSourcesService: any;
  featureStoreService: any;
  functionsService: any;
  indexesService: any;
  llmService: any;
  modelsService: any;
  promptSetsService: any;
  searchService: any;
  tracesService: any;
}

interface RunParams {
  semanticFunctionName: string;
  args: any;
  modelKey: string;
  modelParams: ModelParams;
  isBatch: boolean;
}

export class LocalExecutor {

  dataSourcesService: any;
  featureStoreService: any;
  functionsService: any;
  indexesService: any;
  llmService: any;
  modelsService: any;
  promptSetsService: any;
  searchService: any;
  tracesService: any;

  constructor({
    dataSourcesService,
    featureStoreService,
    functionsService,
    indexesService,
    llmService,
    modelsService,
    promptSetsService,
    searchService,
    tracesService,
  }: LocalExecutorParams) {
    this.dataSourcesService = dataSourcesService;
    this.featureStoreService = featureStoreService;
    this.functionsService = functionsService;
    this.indexesService = indexesService;
    this.llmService = llmService;
    this.modelsService = modelsService;
    this.promptSetsService = promptSetsService;
    this.searchService = searchService;
    this.tracesService = tracesService;
  }

  async run({ semanticFunctionName, args, modelKey, modelParams, isBatch }: RunParams) {
    logger.info('execute function', semanticFunctionName);
    if (!isBatch) logger.debug('args:', args);
    logger.debug('model:', modelKey, modelParams);

    modelParams = this.fixModelParams(modelParams);

    const semanticFunctionInfo = await this.functionsService.getFunctionByName(semanticFunctionName);
    const semanticFunction = await createSemanticFunction(semanticFunctionInfo);
    semanticFunction.onSemanticFunctionEnd = this.saveTrace;

    return semanticFunction.call({ args, modelKey, modelParams, isBatch });
  }

  fixModelParams(modelParams: ModelParams) {
    return {
      ...modelParams,
      maxTokens: this.fixNumber(modelParams.maxTokens, 140),
      n: this.fixNumber(modelParams.n, 1),
    };
  }

  fixNumber(value: any, defaultValue: number = 0) {
    const num = +value;
    return isNaN(num) ? defaultValue : num;
  }

  saveTrace({ traceRecord }) {
    this.tracesService.upsertTrace(traceRecord);
  }

}

function createPromptTemplate(promptTemplateInfo: any) {
  const messages = promptTemplateInfo.prompts
    .map((p: { role: string; prompt: string; }) => ({
      role: p.role,
      content: p.prompt,
    }))
    .map(message);
  return new PromptTemplate({
    messages,
    schema: promptTemplateInfo.arguments,
    templateEngine: promptTemplateInfo.templateEngine,
  });
}

function createModel(modelInfo: any, chatCompletionService: ChatCompletionService) {
  return new LLMChatModel({
    modelKey: modelInfo.name,
    chatCompletionService,
  });
}

function createFeatureStoreEnrichment(featureStoreInfo: any) {
  const featureStoreParams = {
    appId: featureStoreInfo.appId,
    appSecret: featureStoreInfo.appSecret,
    entity: featureStoreInfo.entity,
    featureList: featureStoreInfo.featureList,
    featureService: featureStoreInfo.featureService,
    featureStoreName: featureStoreInfo.featureStoreName,
    httpMethod: featureStoreInfo.httpMethod,
    url: featureStoreInfo.url,
  };
  return new FeatureStoreEnrichment({
    featurestore: featureStoreInfo.featurestore,
    featureStoreParams,
    featureStoreService: this.featureStoreService,
  });
}

function createSemanticSearchEnrichment(indexInfo: any, index: any) {
  const indexParams = {
    indexContentPropertyPath: indexInfo.indexContentPropertyPath,
    indexContextPropertyPath: indexInfo.indexContextPropertyPath,
    allResults: indexInfo.allResults,
  };
  return new SemanticSearchEnrichment({
    indexName: index.name,
    indexParams,
    searchService: this.searchService,
  });
}

async function createFunctionEnrichment(indexInfo: any) {
  const semanticFunctionInfo = await this.functionsService.getFunctionByName('summarize');
  const semanticFunction = await createSemanticFunction(semanticFunctionInfo);
  const modelParams = {
    maxTokens: 255,
    n: 1,
  };
  return new FunctionEnrichment({
    semanticFunction,
    modelKey: 'gpt-3.5-turbo',
    modelParams,
    contentPropertyPath: indexInfo.indexContentPropertyPath,
    contextPropertyPath: indexInfo.indexContextPropertyPath,
  });
}

async function createPromptEnrichmentPipeline(implInfo: any) {
  const steps: PromptEnrichmentStep[] = [];
  if (implInfo.dataSourceId) {
    const featureStoreInfo = await this.dataSourcesService.getDataSource(implInfo.dataSourceId);
    steps.push(createFeatureStoreEnrichment(featureStoreInfo));
  }
  if (implInfo.indexes) {
    for (const indexInfo of implInfo.indexes) {
      const index = await this.indexesService.getIndex(indexInfo.indexId);
      steps.push(createSemanticSearchEnrichment(indexInfo, index));
      if (indexInfo.summarizeResults) {
        const summarizer = await createFunctionEnrichment(indexInfo);
        steps.push(summarizer);
      }
    }
  }
  const promptTemplateInfo = await this.promptSetsService.getPromptSet(implInfo.promptSetId);
  const promptTemplate = createPromptTemplate(promptTemplateInfo);
  return new PromptEnrichmentPipeline({
    promptTemplate,
    steps,
  });
}

async function createSemanticFunction(semanticFunctionInfo: any) {
  const implementations: SemanticFunctionImplementation[] = [];
  for (const implInfo of semanticFunctionInfo.implementations) {
    const modelInfo = await this.modelsService.getModel(implInfo.modelId);
    const model = createModel(modelInfo, this.llmService.fetchChatCompletion);
    const promptEnrichmentPipeline = await createPromptEnrichmentPipeline(implInfo);
    const impl = new SemanticFunctionImplementation({
      model,
      promptEnrichmentPipeline,
      isDefault: implInfo.isDefault,
    });
    implementations.push(impl);
  }
  return new SemanticFunction({
    name: semanticFunctionInfo.name,
    argsSchema: semanticFunctionInfo.arguments,
    implementations,
  });
}
