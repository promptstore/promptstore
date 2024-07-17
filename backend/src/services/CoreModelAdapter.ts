import isEmpty from 'lodash.isempty';

import { AgentRuntime } from '../agents/AgentRuntime';
import { Model } from '../core/common_types';
import { Callback } from '../core/callbacks/Callback';
import {
  agentNode,
  composition,
  compositionNode,
  edge,
  embeddingNode,
  extractorNode,
  functionNode,
  functionRouterNode,
  graphStoreNode,
  indexNode,
  joinerNode,
  loaderNode,
  loopNode,
  mapperNode,
  outputNode,
  requestNode,
  scheduleNode,
  sourceNode,
  toolNode,
  transformerNode,
  vectorStoreNode,
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
  rulesetsGuardrail,
} from '../core/outputprocessing/OutputProcessingPipeline';
import { PromptEnrichmentStep, Snippet } from '../core/promptenrichment/PromptEnrichmentPipeline_types';
import {
  PromptEnrichmentPipeline,
  promptEnrichmentPipeline,
  featureStoreEnrichment,
  semanticSearchEnrichment,
  functionEnrichment,
  metricStoreEnrichment,
  sqlEnrichment,
  knowledgeGraphEnrichment,
} from '../core/promptenrichment/PromptEnrichmentPipeline';
import { message, promptTemplate } from '../core/promptenrichment/PromptTemplate';
import SemanticCache from '../core/semanticcache/SemanticCache';
import {
  SemanticFunction,
  semanticFunction,
} from '../core/semanticfunctions/SemanticFunction';
import {
  SemanticFunctionImplementation,
  semanticFunctionImplementation,
} from '../core/semanticfunctions/SemanticFunctionImplementation';
import { fillTemplate } from '../utils';

const FACT_EXTRACTION_FUNCTION = 'extract_facts';
const QUERY_REWRITE_FUNCTION = 'rewrite_query';
const SUMMARIZE_FUNCTION = 'summarize';

export default ({ agents, logger, rc, services }) => {

  const {
    agentsService,
    compositionsService,
    dataSourcesService,
    featureStoreService,
    functionsService,
    graphStoreService,
    guardrailsService,
    indexesService,
    llmService,
    metricStoreService,
    modelProviderService,
    modelsService,
    parserService,
    pipelinesService,
    promptSetsService,
    settingsService,
    sqlSourceService,
    rulesEngineService,
    rulesService,
    toolService,
    vectorStoreService,
  } = services;

  function createPromptTemplate(promptTemplateInfo: any, snippets: object, callbacks: Callback[]) {
    const messages = promptTemplateInfo.prompts
      .map((p: { role: string; prompt: string; }) => ({
        role: p.role,
        content: p.prompt,
      }))
      .map(message);
    return promptTemplate({
      promptSetId: promptTemplateInfo.id,
      promptSetName: promptTemplateInfo.name,
      schema: promptTemplateInfo.arguments,
      snippets,
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
      modelId: modelInfo.id,
      modelName: modelInfo.name,
      model: modelInfo.key,
      provider: modelInfo.provider,
      contextWindow: modelInfo.contextWindow,
      maxOutputTokens: modelInfo.maxOutputTokens,
      completionService,
      semanticCache,
      semanticCacheEnabled,
      callbacks,
    });
  }

  let cacheSingleton: SemanticCache;

  function createSemanticCache(provider: string) {
    if (!cacheSingleton) {
      cacheSingleton = new SemanticCache(llmService, rc, logger);
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
      modelId: modelInfo.id,
      modelName: modelInfo.name,
      model: modelInfo.key,
      provider: modelInfo.provider,
      contextWindow: modelInfo.contextWindow,
      maxOutputTokens: modelInfo.maxOutputTokens,
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

  function createSemanticSearchEnrichment(indexInfo: any, index: any, rerankerModel: any, callbacks: Callback[]) {
    const indexParams = {
      indexContentPropertyPath: indexInfo.indexContentPropertyPath,
      indexContextPropertyPath: indexInfo.indexContextPropertyPath,
      allResults: indexInfo.allResults,
      nodeLabel: index.nodeLabel,
      embeddingModel: {
        provider: index.embeddingProvider,
        model: index.embeddingModel,
      },
      vectorStoreProvider: index.vectorStoreProvider,
    };
    return semanticSearchEnrichment({
      indexId: index.id,
      indexName: index.name,
      indexParams,
      llmService,
      vectorStoreService,
      rerankerModel,
      callbacks,
    });
  }

  async function createFunctionEnrichment(workspaceId: number, indexInfo: any, callbacks: Callback[]) {
    const semanticFunctionInfo = await functionsService.getFunctionByName(workspaceId, SUMMARIZE_FUNCTION);
    const semanticFunction = await createSemanticFunction(workspaceId, semanticFunctionInfo, callbacks);
    const modelParams = {
      max_tokens: 64,
      n: 1,
    };
    return functionEnrichment({
      semanticFunction,
      model: {
        model: 'gpt-3.5-turbo-0613',
        provider: 'openai',
      },
      modelParams,
      contentPropertyPath: indexInfo.indexContentPropertyPath,
      contextPropertyPath: indexInfo.indexContextPropertyPath,
      callbacks,
    });
  }

  function createMetricStoreEnrichment(metricStoreInfo: any, callbacks: Callback[]) {
    const metricStoreParams = {
      environmentId: metricStoreInfo.environmentId,
      httpMethod: metricStoreInfo.httpMethod,
      url: metricStoreInfo.url,
    };
    return metricStoreEnrichment({
      metricstore: metricStoreInfo.metricstore,
      metricStoreParams,
      metricStoreService,
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

  async function createOutputProcessingPipeline(workspaceId: number, implInfo: any, callbacks: Callback[]) {
    const steps: OutputProcessingStep[] = [];
    if (implInfo.outputGuardrails) {
      for (const guardrail of implInfo.outputGuardrails) {
        steps.push(outputGuardrail({ guardrail, guardrailsService, callbacks }));
      }
    }
    if (implInfo.outputParser) {
      steps.push(outputParser({ outputParser: implInfo.outputParser, parserService, callbacks }));
    }
    if (implInfo.rules?.length) {
      const rulesets = [];
      for (const id of implInfo.rules) {
        const { ontology } = await rulesService.getRule(id);
        if (ontology) {
          rulesets.push({ id, ontology });
        }
      }
      const semanticFunctionInfo = await functionsService.getFunctionByName(workspaceId, FACT_EXTRACTION_FUNCTION);
      const semanticFunction = await createSemanticFunction(workspaceId, semanticFunctionInfo, callbacks);
      steps.push(rulesetsGuardrail({
        rulesets,
        semanticFunction,
        rulesEngineService,
        callbacks,
      }));
    }
    return outputProcessingPipeline({ callbacks })(steps);
  }

  async function createPromptEnrichmentPipeline(workspaceId: number, implInfo: any, callbacks: Callback[], extraIndexes?: number[]) {
    const steps: PromptEnrichmentStep[] = [];
    if (implInfo.dataSourceId) {
      const featureStoreInfo = await dataSourcesService.getDataSource(implInfo.dataSourceId);
      steps.push(createFeatureStoreEnrichment(featureStoreInfo, callbacks));
    }
    if (implInfo.metricStoreSourceId) {
      const metricStoreInfo = await dataSourcesService.getDataSource(implInfo.metricStoreSourceId);
      steps.push(createMetricStoreEnrichment(metricStoreInfo, callbacks));
    }
    if (implInfo.sqlSourceId) {
      const sqlSourceInfo = await dataSourcesService.getDataSource(implInfo.sqlSourceId);
      steps.push(createSqlEnrichment(sqlSourceInfo, callbacks));
    }
    if (implInfo.graphSourceId) {
      const graphSourceInfo = await dataSourcesService.getDataSource(implInfo.graphSourceId);
      steps.push(createKnowledgeGraphEnrichment(graphSourceInfo, callbacks));
    }
    const paths = {
      indexContentPropertyPath: implInfo.indexContentPropertyPath || 'content',
      indexContextPropertyPath: implInfo.indexContextPropertyPath || 'context',
    };
    let rerankerModel: any;
    if (implInfo.rerankerModelId) {
      const model = await modelsService.getModel(implInfo.rerankerModelId);
      rerankerModel = {
        provider: model.provider,
        model: model.key,
      };
    }
    if (implInfo.indexes) {
      for (let indexInfo of implInfo.indexes) {
        indexInfo = { ...indexInfo, ...paths };
        // logger.debug('indexInfo:', indexInfo);
        const index = await indexesService.getIndex(indexInfo.indexId);
        // logger.debug('index:', index);
        steps.push(createSemanticSearchEnrichment(indexInfo, index, rerankerModel, callbacks));
        if (indexInfo.summarizeResults) {
          const summarizer = await createFunctionEnrichment(workspaceId, indexInfo, callbacks);
          steps.push(summarizer);
        }
      }
    }
    if (extraIndexes) {
      for (const indexId of extraIndexes) {
        const indexInfo = {
          ...paths,
          // allResults: false,  // TODO
          allResults: true,
        };
        const index = await indexesService.getIndex(indexId);
        steps.push(createSemanticSearchEnrichment(indexInfo, index, rerankerModel, callbacks));
      }
    }
    const promptTemplateInfo = await promptSetsService.getPromptSet(implInfo.promptSetId);
    const settings = await settingsService.getSettingsByKey(workspaceId, 'snippets');
    let snippets = {};
    if (Array.isArray(settings[0]?.value)) {
      snippets = settings[0].value.reduce((a: object, s: Snippet) => {
        a[s.key] = s.content;
        return a;
      }, {});
    }
    const promptTemplate = createPromptTemplate(promptTemplateInfo, snippets, callbacks);
    return promptEnrichmentPipeline({ callbacks })(steps, promptTemplate);
  }

  async function createAgent(agentInfo: any) {
    const functions = [];
    for (const f of (agentInfo.functions || [])) {
      const func = await functionsService.getFunction(f.functionId);
      functions.push(func);
    }
    const compositions = [];
    for (const c of (agentInfo.compositions || [])) {
      const composition = await compositionsService.getComposition(c.compositionId);
      compositions.push(composition);
    }
    const subAgents = [];
    for (const a of (agentInfo.subAgents || [])) {
      const agent = await agentsService.getAgent(a.agentId);
      subAgents.push(agent);
    }
    let goal: string;
    if (agentInfo.promptSetId) {
      const promptSet = await promptSetsService.getPromptSet(agentInfo.promptSetId);
      goal = promptSet.prompts.map((p: any) => p.prompt).join('\n\n');
      if (agentInfo.metricStoreSourceId) {
        const metricStoreInfo = await dataSourcesService.getDataSource(agentInfo.metricStoreSourceId);
        const metricStoreParams = {
          environmentId: metricStoreInfo.environmentId,
          httpMethod: metricStoreInfo.httpMethod,
          url: metricStoreInfo.url,
        };
        const metrics = await metricStoreService.getMetrics(
          metricStoreInfo.metricstore,
          metricStoreParams,
        );
        logger.debug('metrics:', metrics);
        const metricsInput = metrics.map((m: any) => ({
          name: m.name,
          dimensions: m.dimensions.map((d: any) => d.name),
        }));
        goal = fillTemplate(goal, {
          metrics: metricsInput,
        }, 'es6');
      }
    }
    let model: string, provider: string;
    if (agentInfo.modelId) {
      const m = await modelsService.getModel(agentInfo.modelId);
      model = m.key;
      provider = m.provider;
    }
    logger.debug('agentInfo:', agentInfo);
    const options = {
      agentType: agentInfo.agentType,
      agents,
      allowedTools: agentInfo.allowedTools,
      compositions: compositions.length ? compositions : undefined,
      functions: functions.length ? functions : undefined,
      subAgents: subAgents.length ? subAgents : undefined,
      args: { goal },
      indexName: agentInfo.indexName,
      isChat: true,
      model,
      name: agentInfo.name,
      provider,
      selfEvaluate: agentInfo.selfEvaluate,
      useFunctions: agentInfo.useFunctions,
    };
    logger.debug('agent runtime options:', options);
    const agent = new AgentRuntime(options);
    return agent;
  }

  async function createSemanticFunction(workspaceId: number, semanticFunctionInfo: any, callbacks: Callback[], extraIndexes?: number[]) {
    const implementations: SemanticFunctionImplementation[] = [];
    for (const implInfo of semanticFunctionInfo.implementations) {
      // logger.debug('implInfo:', implInfo);
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
          promptEnrichmentPipeline = await createPromptEnrichmentPipeline(workspaceId, implInfo, callbacks, extraIndexes);
        }
      } else if (modelInfo.type === 'completion') {
        model = createCompletionModel(modelInfo, implInfo.cache, llmService.createCompletion, callbacks);
        if (implInfo.promptSetId) {
          promptEnrichmentPipeline = await createPromptEnrichmentPipeline(workspaceId, implInfo, callbacks, extraIndexes);
        }
      } else if (modelInfo.type === 'api') {
        model = createCustomModel(modelInfo, callbacks);
      } else if (modelInfo.type === 'huggingface') {
        model = createHuggingfaceModel(modelInfo, callbacks);
      } else {
        throw new Error(`model type ${modelInfo.type} not supported`);
      }
      if (!isEmpty(implInfo.inputGuardrails)) {
        inputGuardrails = new InputGuardrails({
          guardrails: implInfo.inputGuardrails,
          guardrailsService,
          callbacks
        });
      }
      if (!isEmpty(implInfo.outputGuardrails) || implInfo.outputParser) {
        outputProcessingPipeline = await createOutputProcessingPipeline(workspaceId, implInfo, callbacks);
      }
      let argsMappingTemplate: string, returnMappingTemplate: string;
      if (typeof implInfo.mappingData === 'string') {
        argsMappingTemplate = implInfo.mappingData.trim();
      }
      if (typeof implInfo.returnMappingData === 'string') {
        returnMappingTemplate = implInfo.returnMappingData.trim();
      }
      let queryRewriteFunction: SemanticFunction;
      if (implInfo.rewriteQuery) {
        const queryRewriteFunctionInfo = await functionsService.getFunctionByName(workspaceId, QUERY_REWRITE_FUNCTION);
        queryRewriteFunction = await createSemanticFunction(workspaceId, queryRewriteFunctionInfo, callbacks);
      }
      const impl = semanticFunctionImplementation({
        environment: implInfo.environment,
        isDefault: implInfo.isDefault,
        argsMappingTemplate,
        returnMappingTemplate,
        indexContentPropertyPath: implInfo.indexContentPropertyPath,
        indexContextPropertyPath: implInfo.indexContextPropertyPath,
        rewriteQuery: implInfo.rewriteQuery,
        summarizeResults: implInfo.summarizeResults,
        queryRewriteFunction,
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
    return semanticFunction(semanticFunctionInfo.id, semanticFunctionInfo.name, semanticFunctionInfo.description, options)(implementations);
  }

  async function createComposition(workspaceId: number, compositionInfo: any, callbacks: Callback[]) {
    const nodes = [];
    for (const nodeInfo of compositionInfo.flow.nodes) {
      switch (nodeInfo.type) {
        case 'requestNode':
          nodes.push(requestNode(nodeInfo.id, nodeInfo.arguments));
          break;

        case 'agentNode':
          let agentId = nodeInfo.data.agentId;
          let agentInfo = await agentsService.getAgent(agentId);
          let agent = await createAgent(agentInfo);
          nodes.push(agentNode(nodeInfo.id, agent));
          break;

        case 'functionNode':
          let functionId = nodeInfo.data.functionId;
          let functionInfo = await functionsService.getFunction(functionId);
          let func = await createSemanticFunction(workspaceId, functionInfo, callbacks);
          nodes.push(functionNode(nodeInfo.id, func));
          break;

        case 'functionRouterNode':
          nodes.push(functionRouterNode(nodeInfo.id));
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
          nodes.push(toolNode(nodeInfo.id, tool, nodeInfo.data.raw));
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

        case 'sourceNode':
          let dataSourceId = nodeInfo.data.dataSourceId;
          let dataSource = await dataSourcesService.getDataSource(dataSourceId);
          nodes.push(sourceNode(nodeInfo.id, dataSource));
          break;

        case 'indexNode':
          let indexId = nodeInfo.data.indexId;
          let index = await indexesService.getIndex(indexId);
          nodes.push(indexNode(nodeInfo.id, index));
          break;

        case 'scheduleNode':
          nodes.push(scheduleNode(nodeInfo.id, nodeInfo.data.schedule));
          break;

        case 'loaderNode':
          nodes.push(loaderNode(nodeInfo.id, nodeInfo.data));
          break;

        case 'extractorNode':
          nodes.push(extractorNode(nodeInfo.id, nodeInfo.data));
          break;

        case 'vectorStoreNode':
          nodes.push(vectorStoreNode(nodeInfo.id, nodeInfo.data.vectorStoreProvider, nodeInfo.data.newIndexName));
          break;

        case 'graphStoreNode':
          nodes.push(graphStoreNode(nodeInfo.id, nodeInfo.data.graphStoreProvider));
          break;

        case 'embeddingNode':
          nodes.push(embeddingNode(nodeInfo.id, nodeInfo.data.embeddingModel));
          break;

        case 'loopNode':
          nodes.push(loopNode(nodeInfo.id, nodeInfo.data.loopVar, nodeInfo.data.aggregationVar));
          break;

        case 'transformerNode':
          nodes.push(transformerNode(nodeInfo.id, nodeInfo.data.functionId));
          break;

        default:
      }
    }
    const edges = [];
    for (const edgeInfo of compositionInfo.flow.edges) {
      edges.push(edge(edgeInfo.id, edgeInfo.source, edgeInfo.sourceHandle, edgeInfo.target));
    }
    return composition(compositionInfo.name, nodes, edges, pipelinesService, callbacks);
  }

  return {
    createAgent,
    createComposition,
    createSemanticFunction,
  };

}
