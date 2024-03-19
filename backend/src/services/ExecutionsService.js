import { getEncoding } from 'js-tiktoken';

import { CallLoggingCallback } from '../core/callbacks/CallLoggingCallback.ts';
import { DebugCallback } from '../core/callbacks/DebugCallback.ts';
import { TracingCallback } from '../core/callbacks/TracingCallback.ts';
import { LocalExecutor } from '../core/executors/LocalExecutor.js';
import { formatTextAsJson, getInput, hashStr } from '../utils.js';

import CoreModelAdapter from './CoreModelAdapter.ts';

export function ExecutionsService({ logger, rc, services }) {

  let _services = services;

  const {
    compositionsService,
    creditCalculatorService,
    dataSourcesService,
    featureStoreService,
    functionsService,
    graphStoreService,
    guardrailsService,
    indexesService,
    llmService,
    modelProviderService,
    modelsService,
    parserService,
    pipelinesService,
    promptSetsService,
    sqlSourceService,
    toolService,
    tracesService,
    usersService,
    vectorStoreService,
  } = services;

  const addServices = (services) => {
    _services = { ..._services, ...services };
  }

  let _adapter;

  const getAdapter = () => {
    if (!_adapter) {
      _adapter = CoreModelAdapter({
        logger, rc, services: {
          compositionsService,
          dataSourcesService,
          featureStoreService,
          functionsService,
          graphStoreService,
          guardrailsService,
          indexesService,
          llmService,
          modelProviderService,
          modelsService,
          parserService,
          pipelinesService,
          promptSetsService,
          sqlSourceService,
          toolService,
          vectorStoreService,
          ..._services,
        }
      });
    }
    return _adapter;
  }

  const executeFunction = async ({
    workspaceId,
    username,
    semanticFunctionName,
    func,
    args,
    messages,
    history,
    extraSystemPrompt,
    params,
    model,
    functions,
    options,
    extraIndexes,
    batch = false,
    debug = false,
  }) => {
    if (!params) params = {};
    const { credits, errors } = await usersService.checkCredits(username);
    if (errors) {
      return { errors };
    }
    let creditBalance = credits;
    const semanticFunctionInfo = func || await functionsService.getFunctionByName(workspaceId, semanticFunctionName);
    if (!semanticFunctionInfo) {
      const errors = [
        {
          message: `Function ${semanticFunctionName} not found`,
        },
      ];
      return { errors };
    }

    const callbacks = [
      new TracingCallback({ workspaceId, username, tracesService }),
      new CallLoggingCallback({ workspaceId, username }),
    ];
    if (debug) {
      callbacks.push(new DebugCallback());
    }
    const adapter = getAdapter();
    const semanticFunction = await adapter.createSemanticFunction(
      workspaceId,
      semanticFunctionInfo,
      callbacks,
      extraIndexes
    );

    // TODO - auto or explicit, originally added to support content gen app
    if (!batch) {
      const userContent = getInput(args);
      if (userContent) {
        const wordCount = userContent.split(/\s+/).length;
        const maxWords = Math.floor(wordCount * 1.2);
        args = {
          ...args,
          wordCount,
          maxWords,
        };
      }
    }

    const executor = new LocalExecutor();

    try {
      let response_format;
      if (params.jsonMode) {
        response_format = { type: 'json_object' };
      }
      const modelParams = {
        max_tokens: params.maxTokens,
        n: params.n,
        temperature: params.temperature,
        top_p: params.topP,
        stop: params.stop,
        presence_penalty: params.presencePenalty,
        frequency_penalty: params.frequencyPenalty,
        seed: params.seed,
        response_format,
      };
      const run = async (args) => {
        let { response, responseMetadata } = await executor.runFunction({
          semanticFunction,
          args,
          messages,
          history,
          extraSystemPrompt,
          model,
          modelParams,
          functions,
          isBatch: batch,
          options,
          workspaceId,
          username,
        });
        const { images, promptTokens, completionTokens } = responseMetadata;
        const { provider } = await modelsService.getModelByKey(workspaceId, response.model);
        const costComponents = creditCalculatorService.getCostComponents({
          name: semanticFunctionName,
          provider,
          model: response.model,
          batch,
          inputTokens: promptTokens,
          outputTokens: completionTokens,
          images,
          imageCount: images?.length || 0,
        });
        const totalCost = responseMetadata.totalCost + costComponents.totalCost;
        creditBalance -= totalCost * 1000;
        await usersService.upsertUser({ username, credits: creditBalance });
        const costs = [...(responseMetadata.costs || []), costComponents];
        responseMetadata = {
          ...responseMetadata,
          totalCost,
          creditBalance,
          costs,
        };
        // logger.debug('response metadata:', responseMetadata);

        return { response, responseMetadata };
      };

      // TODO move into `SemanticFunctionImplementation` where the model
      // (and context window) is known
      /*
      if (batch) {
        // const model = await modelsService.getModelByKey(workspaceId, modelKey);
        const model = await modelsService.getModelByKey(workspaceId, 'gpt-3.5-turbo-0613');
        const maxTokensPerRequest = model.contextWindow * 0.9;  // leave a little buffer
        const maxTokensPerChat = maxTokensPerRequest - params.maxTokens;

        const originalTexts = getInput(args, true);

        const originalHashes = [];
        const dedupedTexts = [];
        for (const text of originalTexts) {
          if (text && typeof text === 'string' && text.trim().length) {
            const hash = hashStr(text);
            // de-dup
            if (originalHashes.indexOf(hash) === -1) {
              dedupedTexts.push(text);
            }
            originalHashes.push(hash);
          } else {
            originalHashes.push(null);
          }
        }
        // logger.debug('originalHashes:', originalHashes);

        const bins = binPackTextsInOrder(dedupedTexts, maxTokensPerChat);
        // logger.debug('bins:', bins);

        const data = Array(originalHashes.length).fill(null);
        const proms = bins.map(bin => run({ text: bin }));
        const res = await Promise.all(proms);  // preserves order
        let i = 0;  // bin iteration
        for (const { errors, response } of res) {
          if (errors) {
            logger.error('Error parsing %s response (bin %d):', semanticFunctionName, i + 1, errors);
            continue;
          }
          try {
            const serializedJson = response.choices[0].message.function_call.arguments;
            const json = JSON.parse(serializedJson);
            logger.debug('json:', json);
            const values = json.map(el => el[args.featureName]);
            for (let j = 0; j < values.length; j++) {  // value iteration
              const hash = hashStr(bins[i][j]);
              let k = -1;
              while ((k = originalHashes.indexOf(hash, k + 1)) !== -1) {  // matching hash index iteration
                data[k] = values[j];
              }
            }
          } catch (err) {
            logger.error('Error parsing %s response (bin %d):', semanticFunctionName, i + 1, err);
          }
          i += 1;
        }
        return data;

      } else {*/
      return run(args);
      // }
    } catch (err) {
      let message = `Error running function "${semanticFunctionName}": ` + err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      logger.error(message);
      const errors = [{ message }];
      return { errors };
    }
  };

  const executeComposition = async ({
    workspaceId,
    username,
    compositionName,
    args,
    model,
    params,
    functions,
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
    const adapter = getAdapter();
    const composition = await adapter.createComposition(workspaceId, compositionInfo, callbacks);

    const executor = new LocalExecutor();
    const userContent = getInput(args);
    if (userContent) {
      const wordCount = userContent.split(/\s+/).length;
      const maxWords = Math.floor(wordCount * 1.2);
      args = {
        ...args,
        wordCount,
        maxWords,
        workspaceId,
      };
    }
    if (!args) args = {};
    args = { ...args, username, workspaceId };
    try {
      let response_format;
      if (params.jsonMode) {
        response_format = { type: 'json_object' };
      }
      const modelParams = {
        max_tokens: params.maxTokens,
        n: params.n,
        temperature: params.temperature,
        top_p: params.topP,
        stop: params.stop,
        presence_penalty: params.presencePenalty,
        frequency_penalty: params.frequencyPenalty,
        seed: params.seed,
        response_format,
      };
      const response = await executor.runComposition({
        composition,
        args,
        model,
        modelParams,
        functions,
        isBatch: batch,
      });

      // TODO - or pass through
      const user = await usersService.getUser(username);
      const creditBalance = user.credits;

      return { ...response, creditBalance };
    } catch (err) {
      const errors = [
        {
          message: String(err),
        },
      ];
      return { errors };
    }
  }

  /*
  const truncateTextByTokens = (text, maxTokens, encoding) => {
    const tokens = encoding.encode(text);
    const truncatedTokens = tokens.slice(0, maxTokens);
    return encoding.decode(truncatedTokens);
  }*/

  /**
   * Binpacks a list of texts into a list of lists of texts, such that each list of texts
   * has a total number of tokens less than or equal to maxTokensPerBin and each list of texts
   * has a number of texts less than or equal to maxTextsPerBin.
   *
   * The binpacking uses a naive greedy algorithm that maintains the order of the texts.
   *
   * @param {Array<string>} texts List of texts to binpack. Empty texts are accepted, 
   *        counted as 0 tokens each and count against maxTextsPerBin.
   * @param {number} maxTokensPerBin The maximum number of tokens per bin of formatted texts.
   *        Leave some room for relative to the model's context size to account for the tokens in the
   *        system message, function call, and function return.
   * @param {number} maxTextsPerBin The maximum number of texts per list of texts. Defaults to None, which
   *        means that there is no limit on the number of texts per list of texts.
   * @param {Function} formatter A function that takes a list of texts and returns a single
   *        text. Defaults to None, which means that the texts are joined with spaces.
   *        This function is used to include the overhead of the formatter function in
   *        the binpacking. It is not used to format the output. Make sure to use
   *        the same formatter function when formatting the output for the model.
   * @param {string} encodingName The name of the encoding to use. Defaults to "cl100k_base".
   * @param {string} longTextHandling How to handle texts that are longer than max_tokens_per_bin. Defaults
   *        to "error", which means that an error is raised. Can also be set to
   *        "truncate", which means that the text is truncated to max_tokens_per_bin.
   *        It is possible that more tokens are truncated than absolutely necessary
   *        due to overhead of the formatter function caused by escaping characters.
   * @returns A list of lists of texts. The order of the texts is preserved.
   */
  /*
  const binPackTextsInOrder = (texts, maxTokensPerBin, maxTextsPerBin, formatter, encodingName, longTextHandling) => {
    if (!Array.isArray(texts)) {
      throw new Error('texts must be a list.');
    }
    if (!formatter) {
      formatter = formatTextAsJson;
    }
    if (!maxTextsPerBin) {
      maxTextsPerBin = texts.length;
    }
    if (!encodingName) {
      encodingName = 'cl100k_base';
    }
    if (!longTextHandling) {
      longTextHandling = 'error';
    }
    const encoding = getEncoding(encodingName);
    const bins = [];
    let currentBin = [];
    for (let i = 0; i < texts.length; i++) {
      let text = texts[i];
      if (currentBin.length === maxTextsPerBin) {
        // start a new bin
        bins.push(currentBin);
        currentBin = [];
      }
      // calculate how many tokens would be in the current bin if we added the text
      const binTokensWithNewText = encoding.encode(formatter([...currentBin, text])).length;
      if (binTokensWithNewText > maxTokensPerBin) {
        if (currentBin.length > 0) {
          // start a new bin
          bins.push(currentBin);
          currentBin = [];
        }
        // check if the text fits in a bin by itself
        const tokensTextWithFormatting = encoding.encode(formatter([text])).length;
        if (tokensTextWithFormatting > maxTokensPerBin) {
          // calculate the overhead of the formatter function
          const tokensTextRaw = encoding.encode(text).length;
          const overhead = tokensTextWithFormatting - tokensTextRaw;
          if (overhead > maxTextsPerBin) {
            throw new Error(
              `The formatting function adds ${overhead} overhead tokens, ` +
              `which exceeds the maximum number of tokens (${maxTokensPerBin}) permitted.`
            );
          }
          if (binTokensWithNewText > maxTextsPerBin) {
            // the formatted text is too long to fit in a bin
            if (longTextHandling === 'error') {
              throw new Error(
                `The text at index ${i} has ${tokensTextWithFormatting} tokens, which ` +
                `is greater than the maximum number of tokens (${maxTokensPerBin}). ` +
                `Note that a formatting function added ${overhead} tokens to the text.`
              );
            } else if (longTextHandling === 'truncate') {
              // Truncate the text, accounting for overhead
              // It's possible that more is truncated than necessary
              // in case the overhead was caused by escaping characters
              // in the truncated part of the text
              text = truncateTextByTokens(text, maxTokensPerBin - overhead, encoding);
              // assert(encoding.encode(formatter([text]) <= maxTextsPerBin));
            } else {
              throw new Error(
                `Invalid value for longTextHandling: ${longTextHandling}. ` +
                `Must be one of "error" or "truncate".`
              );
            }
          }
        }
      }
      // add to the current bin
      currentBin.push(text);
    }
    // add to the last bin
    bins.push(currentBin);

    return bins;
  }*/

  return {
    executeComposition,
    executeFunction,
    addServices,
  };
}
