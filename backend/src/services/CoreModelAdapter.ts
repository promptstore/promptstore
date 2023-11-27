import isEmpty from 'lodash.isempty';

import { Model } from '../core/common_types';
import { Callback } from '../core/callbacks/Callback';
import {
  composition,
  edge,
  functionNode,
  compositionNode,
  toolNode,
  joinerNode,
  mapperNode,
  requestNode,
  outputNode,
} from '../core/compositions/Composition';
import { InputGuardrails } from '../core/guardrails/InputGuardrails';
import { CompletionService } from '../core/models/llm_types';
import { completionModel, customModel, huggingfaceModel, llmModel } from '../core/models/Model';
import { OutputProcessingStep } from '../core/outputprocessing/OutputProcessingPipeline_types';
import {
  OutputProcessingPipeline,
  outputProcessingPipeline,
  outputGuardrail,
  outputParser,
} from '../core/outputprocessing/OutputProcessingPipeline';
import { PromptEnrichmentStep } from '../core/promptenrichment/PromptEnrichmentPipeline_types';
import {
  PromptEnrichmentPipeline,
  promptEnrichmentPipeline,
  featureStoreEnrichment,
  semanticSearchEnrichment,
  functionEnrichment,
  sqlEnrichment,
  knowledgeGraphEnrichment,
} from '../core/promptenrichment/PromptEnrichmentPipeline';
import { message, promptTemplate } from '../core/promptenrichment/PromptTemplate';
import SemanticCache from '../core/semanticcache/SemanticCache';
import { semanticFunction } from '../core/semanticfunctions/SemanticFunction';
import { SemanticFunctionImplementation, semanticFunctionImplementation } from '../core/semanticfunctions/SemanticFunctionImplementation';

export default ({ logger, rc, services }) => {

  const {
    compositionsService,
    dataSourcesService,
    embeddingService,
    featureStoreService,
    functionsService,
    graphStoreService,
    guardrailsService,
    indexesService,
    llmService,
    modelProviderService,
    modelsService,
    parserService,
    promptSetsService,
    sqlSourceService,
    toolService,
    vectorStoreService,
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

  function createChatModel(
    modelInfo: any,
    semanticCacheEnabled: boolean,
    completionService: CompletionService,
    callbacks: Callback[]
  ) {
    let semanticCache: SemanticCache;
    if (semanticCacheEnabled) {
      semanticCache = createSemanticCache('sentenceencoder');
    }
    return llmModel({
      model: modelInfo.key,
      provider: modelInfo.provider,
      completionService,
      semanticCache,
      semanticCacheEnabled,
      callbacks,
    });
  }

  let cacheSingleton: SemanticCache;

  function createSemanticCache(provider: string) {
    if (!cacheSingleton) {
      const service = {
        createEmbedding: (content: string) => embeddingService.createEmbedding(provider, content),
      };
      cacheSingleton = new SemanticCache(service, rc, logger);
    }
    return cacheSingleton;
  }

  function createCompletionModel(
    modelInfo: any,
    semanticCacheEnabled: boolean,
    completionService: CompletionService,
    callbacks: Callback[]
  ) {
    let semanticCache: SemanticCache;
    if (semanticCacheEnabled) {
      semanticCache = createSemanticCache('sentenceencoder');
    }
    return completionModel({
      model: modelInfo.key,
      provider: modelInfo.provider,
      completionService,
      semanticCache,
      semanticCacheEnabled,
      callbacks,
    });
  }

  function createCustomModel(modelInfo: any, callbacks: Callback[]) {
    return customModel({
      model: modelInfo.key,
      url: modelInfo.url,
      batchEndpoint: modelInfo.batchEndpoint,
      callbacks,
    });
  }

  function createHuggingfaceModel(modelInfo: any, callbacks: Callback[]) {
    return huggingfaceModel({
      model: modelInfo.modelName,
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
      nodeLabel: index.nodeLabel,
      embeddingProvider: index.embeddingProvider,
      vectorStoreProvider: index.vectorStoreProvider,
    };
    return semanticSearchEnrichment({
      indexName: index.name,
      indexParams,
      embeddingService,
      vectorStoreService,
      callbacks,
    });
  }

  async function createFunctionEnrichment(workspaceId: number, indexInfo: any, callbacks: Callback[]) {
    const semanticFunctionInfo = await functionsService.getFunctionByName(workspaceId, 'summarize');
    const semanticFunction = await createSemanticFunction(workspaceId, semanticFunctionInfo, callbacks);
    const modelParams = {
      max_tokens: 64,
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

  function createKnowledgeGraphEnrichment(graphSourceInfo: any, callbacks: Callback[]) {
    return knowledgeGraphEnrichment({
      graphSourceInfo,
      graphStoreService,
      callbacks,
    });
  }

  function createOutputProcessingPipeline(implInfo: any, callbacks: Callback[]) {
    const steps: OutputProcessingStep[] = [];
    if (implInfo.outputGuardrails) {
      for (const guardrail of implInfo.outputGuardrails) {
        steps.push(outputGuardrail({ guardrail, guardrailsService, callbacks }));
      }
    }
    if (implInfo.outputParser) {
      steps.push(outputParser({ outputParser: implInfo.outputParser, parserService, callbacks }));
    }
    return outputProcessingPipeline({ callbacks })(steps);
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
    if (implInfo.graphSourceId) {
      const graphSourceInfo = await dataSourcesService.getDataSource(implInfo.graphSourceId);
      steps.push(createKnowledgeGraphEnrichment(graphSourceInfo, callbacks));
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
      let inputGuardrails: InputGuardrails;
      let outputProcessingPipeline: OutputProcessingPipeline;

      // batching doesn't work with the chat interface. a different technique is required.
      // See https://community.openai.com/t/batching-with-chatcompletion-endpoint/137723
      if (modelInfo.type === 'gpt') {
        model = createChatModel(modelInfo, implInfo.cache, llmService.createChatCompletion, callbacks);
        if (implInfo.promptSetId) {
          promptEnrichmentPipeline = await createPromptEnrichmentPipeline(workspaceId, implInfo, callbacks);
        }
      } else if (modelInfo.type === 'completion') {
        model = createCompletionModel(modelInfo, implInfo.cache, llmService.createCompletion, callbacks);
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
      if (implInfo.inputGuardrails) {
        inputGuardrails = new InputGuardrails({
          guardrails: implInfo.inputGuardrails,
          guardrailsService,
          callbacks
        });
      }
      if (!isEmpty(implInfo.outputGuardrails) || implInfo.outputParser) {
        outputProcessingPipeline = createOutputProcessingPipeline(implInfo, callbacks);
      }
      let argsMappingTemplate: string, returnMappingTemplate: string;
      if (typeof implInfo.mappingData === 'string') {
        argsMappingTemplate = implInfo.mappingData.trim();
      }
      if (typeof implInfo.returnMappingData === 'string') {
        returnMappingTemplate = implInfo.returnMappingData.trim();
      }
      const impl = semanticFunctionImplementation({
        argsMappingTemplate,
        returnMappingTemplate,
        isDefault: implInfo.isDefault,
        callbacks,
      })(model, promptEnrichmentPipeline, inputGuardrails, outputProcessingPipeline);
      implementations.push(impl);
    }
    const options = {
      argsSchema: semanticFunctionInfo.arguments,
      returnType: semanticFunctionInfo.returnType,
      returnTypeSchema: semanticFunctionInfo.returnTypeSchema,
      callbacks,
      experiments: semanticFunctionInfo.experiments,
    };
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

        case 'compositionNode':
          let compositionId = nodeInfo.data.compositionId;
          let compositionInfo = await compositionsService.getComposition(compositionId);
          let composition = await createComposition(workspaceId, compositionInfo, callbacks);
          nodes.push(compositionNode(nodeInfo.id, composition));
          break;

        case 'toolNode':
          let toolKey = nodeInfo.data.toolId;
          let tool = await toolService.getTool(toolKey);
          nodes.push(toolNode(nodeInfo.id, tool));
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
