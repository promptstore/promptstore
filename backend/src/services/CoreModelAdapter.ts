import { Callback } from '../core/Callback';
import {
  composition,
  edge,
  functionNode,
  joinerNode,
  mapperNode,
  requestNode,
  outputNode,
} from '../core/Composition';
import { ChatCompletionService, Model } from '../core/Model_types';
import { customModel, huggingfaceModel, llmModel } from '../core/Model';
import { PromptEnrichmentStep } from '../core/PromptEnrichmentPipeline_types';
import {
  PromptEnrichmentPipeline,
  promptEnrichmentPipeline,
  featureStoreEnrichment,
  semanticSearchEnrichment,
  functionEnrichment,
  sqlEnrichment,
} from '../core/PromptEnrichmentPipeline';
import { message, promptTemplate } from '../core/PromptTemplate';
import { SemanticFunction, semanticFunction } from '../core/SemanticFunction';
import { SemanticFunctionImplementation, semanticFunctionImplementation } from '../core/SemanticFunctionImplementation';

export default ({ logger, services }) => {

  const {
    dataSourcesService,
    featureStoreService,
    functionsService,
    indexesService,
    llmService,
    modelProviderService,
    modelsService,
    promptSetsService,
    searchService,
    sqlSourceService,
  } = services;

  function createPromptTemplate(promptTemplateInfo: any, callbacks: Callback[]) {
    const messages = promptTemplateInfo.prompts
      .map((p: { role: string; prompt: string; }) => ({
        role: p.role,
        content: p.prompt,
      }))
      .map(message);
    return promptTemplate({
      schema: promptTemplateInfo.arguments,
      templateEngine: promptTemplateInfo.templateEngine,
      callbacks,
    })(messages);
  }

  function createModel(modelInfo: any, chatCompletionService: ChatCompletionService, callbacks: Callback[]) {
    return llmModel({
      modelKey: modelInfo.key,
      chatCompletionService,
      callbacks,
    });
  }

  function createCustomModel(modelInfo: any, callbacks: Callback[]) {
    return customModel({
      modelKey: modelInfo.key,
      url: modelInfo.url,
      batchEndpoint: modelInfo.batchEndpoint,
      callbacks,
    });
  }

  function createHuggingfaceModel(modelInfo: any, callbacks: Callback[]) {
    return huggingfaceModel({
      modelKey: modelInfo.modelName,
      modelProviderService,
      callbacks,
    });
  }

  function createFeatureStoreEnrichment(featureStoreInfo: any, callbacks: Callback[]) {
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
    return featureStoreEnrichment({
      featurestore: featureStoreInfo.featurestore,
      featureStoreParams,
      featureStoreService,
      callbacks,
    });
  }

  function createSemanticSearchEnrichment(indexInfo: any, index: any, callbacks: Callback[]) {
    const indexParams = {
      indexContentPropertyPath: indexInfo.indexContentPropertyPath,
      indexContextPropertyPath: indexInfo.indexContextPropertyPath,
      allResults: indexInfo.allResults,
    };
    return semanticSearchEnrichment({
      indexName: index.name,
      indexParams,
      searchService,
      callbacks,
    });
  }

  async function createFunctionEnrichment(workspaceId: number, indexInfo: any, callbacks: Callback[]) {
    const semanticFunctionInfo = await functionsService.getFunctionByName(workspaceId, 'summarize');
    const semanticFunction = await createSemanticFunction(workspaceId, semanticFunctionInfo, callbacks);
    const modelParams = {
      max_tokens: 255,
      n: 1,
    };
    return functionEnrichment({
      semanticFunction,
      modelKey: 'gpt-3.5-turbo',
      modelParams,
      contentPropertyPath: indexInfo.indexContentPropertyPath,
      contextPropertyPath: indexInfo.indexContextPropertyPath,
      callbacks,
    });
  }

  function createSqlEnrichment(sqlSourceInfo: any, callbacks: Callback[]) {
    return sqlEnrichment({
      sqlSourceInfo,
      sqlSourceService,
      callbacks,
    });
  }

  async function createPromptEnrichmentPipeline(workspaceId: number, implInfo: any, callbacks: Callback[]) {
    const steps: PromptEnrichmentStep[] = [];
    if (implInfo.dataSourceId) {
      const featureStoreInfo = await dataSourcesService.getDataSource(implInfo.dataSourceId);
      steps.push(createFeatureStoreEnrichment(featureStoreInfo, callbacks));
    }
    if (implInfo.sqlSourceId) {
      const sqlSourceInfo = await dataSourcesService.getDataSource(implInfo.sqlSourceId);
      steps.push(createSqlEnrichment(sqlSourceInfo, callbacks));
    }
    if (implInfo.indexes) {
      for (const indexInfo of implInfo.indexes) {
        const index = await indexesService.getIndex(indexInfo.indexId);
        steps.push(createSemanticSearchEnrichment(indexInfo, index, callbacks));
        if (indexInfo.summarizeResults) {
          const summarizer = await createFunctionEnrichment(workspaceId, indexInfo, callbacks);
          steps.push(summarizer);
        }
      }
    }
    const promptTemplateInfo = await promptSetsService.getPromptSet(implInfo.promptSetId);
    const promptTemplate = createPromptTemplate(promptTemplateInfo, callbacks);
    return promptEnrichmentPipeline({ callbacks })(steps, promptTemplate);
  }

  async function createSemanticFunction(workspaceId: number, semanticFunctionInfo: any, callbacks: Callback[]) {
    const implementations: SemanticFunctionImplementation[] = [];
    for (const implInfo of semanticFunctionInfo.implementations) {
      logger.debug('implInfo:', implInfo);
      const modelInfo = await modelsService.getModel(implInfo.modelId);
      let model: Model;
      let promptEnrichmentPipeline: PromptEnrichmentPipeline;

      // batching doesn't work with the chat interface. a different technique is required.
      // See https://community.openai.com/t/batching-with-chatcompletion-endpoint/137723
      if (modelInfo.type === 'gpt') {
        model = createModel(modelInfo, llmService.fetchChatCompletion, callbacks);
        if (implInfo.promptSetId) {
          promptEnrichmentPipeline = await createPromptEnrichmentPipeline(workspaceId, implInfo, callbacks);
        }
      } else if (modelInfo.type === 'api') {
        model = createCustomModel(modelInfo, callbacks);
      } else if (modelInfo.type === 'huggingface') {
        model = createHuggingfaceModel(modelInfo, callbacks);
      } else {
        throw new Error(`model type ${modelInfo.type} not supported`);
      }
      const impl = semanticFunctionImplementation({
        argsMappingTemplate: implInfo.mappingData,
        isDefault: implInfo.isDefault,
        callbacks,
      })(model, promptEnrichmentPipeline);
      implementations.push(impl);
    }
    const options = { argsSchema: semanticFunctionInfo.arguments, callbacks };
    return semanticFunction(semanticFunctionInfo.name, options)(implementations);
  }

  async function createComposition(workspaceId: number, compositionInfo: any, callbacks: Callback[]) {
    const nodes = [];
    for (const nodeInfo of compositionInfo.flow.nodes) {
      switch (nodeInfo.type) {
        case 'requestNode':
          nodes.push(requestNode(nodeInfo.id, nodeInfo.arguments));
          break;

        case 'functionNode':
          let functionId = nodeInfo.data.functionId;
          let functionInfo = await functionsService.getFunction(functionId);
          let func = await createSemanticFunction(workspaceId, functionInfo, callbacks);
          nodes.push(functionNode(nodeInfo.id, func));
          break;

        case 'mapperNode':
          nodes.push(mapperNode(nodeInfo.id, nodeInfo.data.mappingData));
          break;

        case 'joinerNode':
          nodes.push(joinerNode(nodeInfo.id));
          break;

        case 'outputNode':
          nodes.push(outputNode(nodeInfo.id));
          break;

        default:
      }
    }
    const edges = [];
    for (const edgeInfo of compositionInfo.flow.edges) {
      edges.push(edge(edgeInfo.id, edgeInfo.source, edgeInfo.target));
    }
    return composition(compositionInfo.name, nodes, edges, callbacks);
  }

  return {
    createComposition,
    createSemanticFunction,
  };

}
