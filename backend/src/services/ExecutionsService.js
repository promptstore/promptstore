import { DebugCallback } from '../core/DebugCallback.ts';
import { TracingCallback } from '../core/TracingCallback.ts';
import { LocalExecutor } from '../core/LocalExecutor.ts';
import { getInputString } from '../core/utils.js';

import CoreModelAdapter from './CoreModelAdapter.ts'

export function ExecutionsService({ logger, services }) {

  const {
    compositionsService,
    dataSourcesService,
    featureStoreService,
    functionsService,
    guardrailsService,
    indexesService,
    llmService,
    modelProviderService,
    modelsService,
    parserService,
    promptSetsService,
    searchService,
    sqlSourceService,
    tracesService,
  } = services;

  const adapter = CoreModelAdapter({
    logger, services: {
      dataSourcesService,
      featureStoreService,
      functionsService,
      guardrailsService,
      indexesService,
      llmService,
      modelProviderService,
      modelsService,
      parserService,
      promptSetsService,
      searchService,
      sqlSourceService,
    }
  });

  const executeFunction = async ({
    workspaceId,
    username,
    semanticFunctionName,
    func,
    args,
    history,
    params,
    functions,
    batch = false,
    debug = false,
  }) => {
    const semanticFunctionInfo = func || await functionsService.getFunctionByName(workspaceId, semanticFunctionName);
    if (!semanticFunctionInfo) {
      const errors = [
        {
          message: `Function ${semanticFunctionName} not found`,
        },
      ];
      return { errors };
    }

    const callbacks = [new TracingCallback({ workspaceId, username, tracesService })];
    if (debug) {
      callbacks.push(new DebugCallback());
    }
    const semanticFunction = await adapter.createSemanticFunction(workspaceId, semanticFunctionInfo, callbacks);

    const executor = new LocalExecutor();
    const userContent = args.content;
    if (userContent) {
      const wordCount = userContent.split(/\s+/).length;
      const maxWords = Math.floor(wordCount * 1.2);
      args = {
        ...args,
        wordCount,
        maxWords,
      };
    }
    try {
      const response = await executor.runFunction({
        semanticFunction,
        args,
        history,
        modelKey: params.modelKey || params.model,
        modelParams: {
          functions,
          max_tokens: params.maxTokens,
          n: params.n,
        },
        isBatch: batch,
        workspaceId,
        username,
      });
      return response;
    } catch (err) {
      logger.error(err, err.stack);
      const errors = [
        {
          message: String(err),
        },
      ];
      return { errors };
    }
  };

  const executeComposition = async ({
    workspaceId,
    username,
    compositionName,
    args,
    params,
    batch = false,
    debug = false,
  }) => {
    const compositionInfo = await compositionsService.getCompositionByName(workspaceId, compositionName);
    if (!compositionInfo) {
      const errors = [
        {
          message: `Composition ${compositionName} not found`,
        },
      ];
      return { errors };
    }

    const callbacks = [new TracingCallback({ workspaceId, username, tracesService })];
    if (debug) {
      callbacks.push(new DebugCallback());
    }
    const composition = await adapter.createComposition(workspaceId, compositionInfo, callbacks);

    const executor = new LocalExecutor();
    const userContent = getInputString(args);
    if (userContent) {
      const wordCount = userContent.split(/\s+/).length;
      const maxWords = Math.floor(wordCount * 1.2);
      args = {
        ...args,
        wordCount,
        maxWords,
      };
    }
    try {
      const response = await executor.runComposition({
        composition,
        args,
        modelKey: params.modelKey || params.model,
        modelParams: {
          max_tokens: params.maxTokens,
          n: params.n,
        },
        isBatch: batch,
        workspaceId,
        username,
      });
      return response;
    } catch (err) {
      const errors = [
        {
          message: String(err),
        },
      ];
      return { errors };
    }
  }

  return {
    executeComposition,
    executeFunction,
  };

}
