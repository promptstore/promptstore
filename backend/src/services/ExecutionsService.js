import axios from 'axios';
import get from 'lodash.get';
import isEmpty from 'lodash.isempty';
import isObject from 'lodash.isobject';
import set from 'lodash.set';
import { mapJsonAsync } from 'jsonpath-mapper';
import { validate } from 'jsonschema';

import { DebugCallback } from '../core/DebugCallback.ts';
import { TracingCallback } from '../core/TracingCallback.ts';
import { LocalExecutor } from '../core/LocalExecutor.ts';
import { getInputString } from '../core/utils.js';
import { fillTemplate, getMessages } from '../utils';
import CoreModelAdapter from './CoreModelAdapter.ts'

export function ExecutionsService({ logger, services }) {

  const {
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
      indexesService,
      llmService,
      modelProviderService,
      modelsService,
      promptSetsService,
      searchService,
      sqlSourceService,
    }
  });

  const executeFunction = async ({ workspaceId, username, semanticFunctionName, func, args, history, params, functions, batch = false, tracer }) => {
    const semanticFunctionInfo = func || await functionsService.getFunctionByName(workspaceId, semanticFunctionName);
    if (!semanticFunctionInfo) {
      const errors = [
        {
          message: `Function ${semanticFunctionName} not found`,
        },
      ];
      return { errors };
    }

    const debugCallback = new DebugCallback();
    const tracingCallback = new TracingCallback({ workspaceId, username, tracesService });
    const semanticFunction = await adapter.createSemanticFunction(workspaceId, semanticFunctionInfo, [debugCallback, tracingCallback]);

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
        modelKey: params.modelKey || params.model || 'gpt-3.5-turbo',
        modelParams: {
          max_tokens: params.maxTokens,
          n: params.n,
        },
        isBatch: batch,
        workspaceId,
        username,
      });
      return { data: response };
    } catch (err) {
      logger.error(err, err.stack);
      const errors = [
        {
          message: String(err),
        },
      ];
      return { errors };
    }

    logger.log('debug', 'execute function: %s', func.name);
    logger.log('debug', 'args:', args);
    logger.log('debug', 'params:', params);

    if (batch && !(Array.isArray(args) && args.length)) {
      const errors = [
        {
          message: 'Array input expected',
        },
      ];
      return { errors };
    }

    let {
      maxTokens = 255,
      modelId,
      model: modelKey,
      n = 1,
      stop,
    } = params || {};
    if (typeof maxTokens === 'string') {
      try {
        maxTokens = parseInt(maxTokens, 10);
      } catch (err) {
        logger.debug('Error parsing `maxTokens` param: ' + String(err));
        maxTokens = 255;
      }
    }

    const functionArgs = batch ? args[0] : args;

    tracer = tracer || new Tracer(func.name + ' ' + new Date().toISOString(), tracesService);
    tracer
      .push({
        type: 'request',
        function: {
          name: func.name,
          args: functionArgs,
        },
        model: {
          name: modelKey,
          params,
        },
        isBatchRequest: batch,
      })
      .down();

    let validatorResult;

    if (func.arguments) {
      validatorResult = validate(functionArgs, func.arguments, { required: true });

      tracer.push({
        type: 'validate-function-arguments',
        arguments: {
          type: 'function',
          values: functionArgs,
        },
        schema: func.arguments,
        isValid: validatorResult.valid,
        errors: validatorResult.errors,
      });

      if (!validatorResult.valid) {
        tracer
          .push({
            type: 'error',
            errors: validatorResult.errors,
          })
          .close();
        return { errors: validatorResult.errors };
      }
    } else {
      logger.log('debug', 'skip function argument validation');
    }

    const implementations = func.implementations;

    if (!implementations || implementations.length === 0) {
      const errors = [
        {
          message: 'No implementations defined',
        },
      ];
      tracer
        .push({
          type: 'error',
          errors,
        })
        .close();
      return { errors };
    }

    let impl, model;
    if (modelId) {
      impl = implementations.find((m) => m.modelId === modelId);
      model = await modelsService.getModel(modelId);
    }
    if (!impl && modelKey) {
      model = await modelsService.getModelByKey(modelKey);
      if (model) {
        impl = implementations.find((m) => m.modelId === model.id);
      }
    }
    if (!impl) {
      impl = implementations.find((m) => m.isDefault);
      model = await modelsService.getModel(impl.modelId);
    }
    if (!impl) {
      impl = implementations[0];
      model = await modelsService.getModel(impl.modelId);
    }

    if (!model) {
      const errors = [
        {
          message: 'Model not found',
        },
      ];
      tracer
        .push({
          type: 'error',
          errors,
        })
        .close();
      return { errors };
    }
    logger.log('debug', 'model:', model);

    let request;
    const mappingTemplate = impl.mappingData;
    if (mappingTemplate) {
      if (batch) {
        request = await Promise.all(args.map((a) => mapArgs(mappingTemplate, a, func.arguments.type === 'array')));
      } else {
        request = await mapArgs(mappingTemplate, args, func.arguments.type === 'array');
      }
      tracer.push({
        type: 'map-arguments',
        in: {
          type: 'function',
          values: functionArgs,
        },
        out: {
          type: 'prompt',
          values: request,
        },
      });
    } else {
      logger.log('debug', 'skip argument mapping');
      request = args;
    }
    request.maxTokens = maxTokens;

    if (impl.dataSourceId) {
      const ds = await dataSourcesService.getDataSource(impl.dataSourceId);

      if (!ds) {
        const errors = [
          {
            message: 'Data Source not found',
          },
        ];
        tracer
          .push({
            type: 'error',
            errors,
          })
          .close();
        return { errors };
      }

      const params = {
        appId: ds.appId,
        appSecret: ds.appSecret,
        entity: ds.entity,
        featureList: ds.featureList,
        featureService: ds.featureService,
        featureStoreName: ds.featureStoreName,
        httpMethod: ds.httpMethod,
        url: ds.url,
      }
      logger.log('debug', 'calling feature store:', ds.featurestore, request.entityId, params);
      const values = await featureStoreService.getOnlineFeatures(ds.featurestore, params, request.entityId);
      // logger.log('debug', 'values:', values);
      request = { ...request, ...values };
      tracer.push({
        type: 'feature-store-injection',
        featureStore: {
          type: ds.featurestore,
          endpoint: {
            httpMethod: ds.httpMethod,
            url: ds.url,
          },
          params: {
            entity: ds.entity,
            featureList: ds.featureList,
            featureService: ds.featureService,
            featureStoreName: ds.featureStoreName,
          },
        },
        entityId: request.entityId,
        values,
      });
    }

    logger.log('debug', 'indexes:', impl.indexes);

    if (impl.indexes?.length) {
      for (const { indexId, indexContentPropertyPath, indexContextPropertyPath, allResults, summarizeResults } of impl.indexes) {
        const index = await indexesService.getIndex(indexId);
        if (!index) {
          const errors = [
            {
              message: 'Index not found',
            },
          ];
          tracer
            .push({
              type: 'error',
              errors,
            })
            .close();
          return { errors };
        }

        const contentPath = indexContentPropertyPath?.trim();
        const contextPath = indexContextPropertyPath?.trim();

        let content;
        if (allResults) {
          content = '*';
        } else if (!contentPath || contentPath === 'root') {
          content = request;
        } else {
          content = get(request, contentPath);
        }

        const res = await searchService.search(index.name, content);

        logger.log('debug', 'res:', res);

        const contextLines = res.map(r => r.content_text);
        let context = contextLines.join('\n\n');
        // logger.log('debug', 'context:', context);

        tracer.push({
          type: 'index-injection',
          index: {
            id: indexId,
            name: index.name,
            params: {
              contentPath,
              contextPath,
              allResults,
              summarizeResults,
            },
          },
          content,
          context: contextLines,
        });

        if (summarizeResults) {
          const summarizeFunc = await functionsService.getFunctionByName('summarize');
          if (!summarizeFunc) {
            const errors = [
              {
                message: 'Summarize function not found',
              },
            ];
            logger.log('error', errors);
            // ignore
            tracer.push({
              type: 'error',
              errors,
            });
          } else {
            tracer
              .push({
                type: 'summarize-context',
              })
              .down();
            const { data, errors } = await executeFunction(summarizeFunc, { text: context }, {
              maxTokens: 255,
              model: 'gpt-3.5-turbo',
              n: 1,
            }, null, false, tracer);
            if (errors) {
              logger.log('error', errors);
              // ignore
              tracer.push({
                type: 'error',
                errors,
              });
            } else {
              context = data.content;
              tracer.up().addProperty('context', context);
            }
          }
        }

        request = set(request, contextPath, context);
      }
    }

    if (impl.sqlSourceId) {
      const source = await dataSourcesService.getDataSource(impl.sqlSourceId);
      if (source.sqlType === 'schema') {
        const context = await sqlSourceService.getSchema(source);
        logger.debug('SQL context: ', JSON.stringify(context, null, 2));
        request = set(request, 'context', context);
      } else if (source.sqlType === 'sample') {
        const context = await sqlSourceService.getSample(source, 'feast_driver_hourly_stats', 10);
        logger.debug('SQL context: ', JSON.stringify(context, null, 2));
        request = set(request, 'context', context);
      }
    }

    const requestArgs = batch ? request[0] : request;

    if (model.type === 'api') {

      if (model.arguments) {
        validatorResult = validate(requestArgs, model.arguments, { required: true });

        if (!validatorResult.valid) {
          return { errors: validatorResult.errors };
        }
      } else {
        logger.log('debug', 'skip model argument validation');
      }

      let resp;
      if (batch) {
        if (!model.batchEndpoint) {
          const errors = [
            {
              message: 'Batch endpoint not supported',
            },
          ];
          return { errors };
        }
        resp = await axios.post(model.batchEndpoint, request);
      } else {
        resp = await axios.post(model.url, request);
      }
      logger.log('debug', 'resp: %s', resp.data);

      return resp;
    }

    if (model.type === 'huggingface') {

      if (model.arguments) {
        validatorResult = validate(requestArgs, model.arguments, { required: true });

        if (!validatorResult.valid) {
          return { errors: validatorResult.errors };
        }
      } else {
        logger.log('debug', 'skip model argument validation');
      }

      let resp;
      if (batch) {
        const errors = [
          {
            message: 'Batch endpoint not supported',
          },
        ];
        return { errors };
      } else {
        resp = await modelProviderService.query('huggingface', model.modelName, request);
      }
      logger.log('debug', 'resp: %s', resp);

      return { data: resp };
    }

    // batching doesn't work with the chat interface. a different technique is required.
    // See https://community.openai.com/t/batching-with-chatcompletion-endpoint/137723
    if (model.type === 'gpt') {

      let messages;
      if (impl.promptSetId) {
        const promptSet = await promptSetsService.getPromptSet(impl.promptSetId);

        if (promptSet.arguments) {
          validatorResult = validate(requestArgs, promptSet.arguments, { required: true });

          tracer.push({
            type: 'validate-prompt-arguments',
            arguments: {
              type: 'prompt',
              values: requestArgs,
            },
            schema: promptSet.arguments,
            isValid: validatorResult.valid,
            errors: validatorResult.errors,
          });

          if (!validatorResult.valid) {
            tracer
              .push({
                type: 'error',
                errors,
              })
              .close();
            return { errors: validatorResult.errors };
          }
        } else {
          logger.log('debug', 'skip prompt-set argument validation');
        }

        if (batch) {
          const p = promptSet.prompts[promptSet.prompts.length - 1];
          const prompt = isObject(p) ? p.prompt : p;
          let i = 0;
          for (const r of request) {
            if (i === 0) {
              messages = getMessages(promptSet.prompts, r, promptSet.templateEngine);
            } else {
              messages.push({
                role: 'user',
                content: fillTemplate(prompt, r, promptSet.templateEngine),
              });
            }
            i += 1;
          }
        } else {
          const userContent = request.content;
          const wordCount = userContent.split(/\s+/).length;
          const maxWords = Math.floor(wordCount * 1.2);
          if (userContent) {
            request = {
              ...request,
              wordCount,
              maxWords,
            }
          }
          messages = getMessages(promptSet.prompts, request, promptSet.templateEngine);
        }
      } else {
        logger.debug('args:', args, ' ', typeof args);
        if (typeof args === 'string') {
          messages = [
            {
              role: 'user',
              content: args,
            }
          ];
        } else if (isObject(args)) {
          const content = args.text || args.input;
          if (content) {
            messages = [
              {
                role: 'user',
                content,
              }
            ];
          } else {
            const errors = [
              {
                message: 'Cannot parse args',
              },
            ];
            return { errors };
          }
        } else {
          const errors = [
            {
              message: 'Cannot parse args',
            },
          ];
          return { errors };
        }
      }
      logger.log('debug', 'messages:', messages);

      const textLines = messages.map((m) => m.content);
      const text = textLines.join('\n\n');
      if (impl.inputGuardrails?.length) {
        for (const key of impl.inputGuardrails) {
          logger.log('debug', 'guardrail: %s', key);
          const res = await guardrailsService.scan(key, text);
          if (res.error) {
            return { errors: [res.error] };
          }
        }
      }

      logger.log('debug', 'params: modelKey=%s maxTokens=%s n=%s', model.key, maxTokens, n);
      const modelParams = {
        max_tokens: maxTokens,
        n,
        functions,
        stop,
      };
      const response = await llmService.fetchChatCompletion({ provider: model.provider, messages, model: model.key, modelParams });

      try {
        const contents = response.choices.map((c) => c.message.content);

        tracer.push({
          type: 'call-model',
          model: {
            provider: model.provider,
            model: model.key,
            params: {
              ...params,
              functions,
            },
          },
          prompt: messages,
          response,
        });
        tracer.addParentProperty('input', textLines);

        const results = [];

        for (const content of contents) {
          let result = content;

          if (impl.outputGuardrails?.length) {
            for (const guardrail of impl.outputGuardrails) {
              // logger.log('debug', 'guardrail: %s', guardrail);
              const res = await guardrailsService.scan(guardrail, result);
              // logger.log('debug', 'result: %s', res);
              if (res.error) {
                return { errors: [res.error] };
              }
              result = res.text;
            }
          }

          if (impl.outputParser) {
            result = await parserService.parse(impl.outputParser, result);
          }

          if (impl.returnMappingData) {
            result = await mapReturnType(impl.returnMappingData, result, model.returnTypeSchema?.type === 'array');
          }

          results.push(result);
        }

        const resp = {
          ...response,
          choices: response.choices.map((c, i) => ({
            ...c,
            message: {
              ...c.message,
              result: results[i],
            }
          }))
        };

        tracer
          .up()
          .addProperty('response', resp)
          .addProperty('output', response.choices[0].message.content)
          .close();

        return {
          data: {
            ...resp,

            // TODO - some usages expect `n=1` which is not correct
            content: response.choices[0].message.content,
            result: results[0],
            functionCall: response.choices[0].message.function_call,
          },
        };

      } catch (err) {
        logger.log('error', err);
        return { errors: [{ message: String(err) }] };
      }
    }

    if (model.type === 'completion') {

      const promptSet = await promptSetsService.getPromptSet(impl.promptSetId);

      if (promptSet.arguments) {
        validatorResult = validate(requestArgs, promptSet.arguments, { required: true });

        if (!validatorResult.valid) {
          return { errors: validatorResult.errors };
        }
      } else {
        logger.log('debug', 'skip prompt set argument validation');
      }

      let input;
      if (batch) {
        input = request.map((r) => {
          const messages = getMessages(promptSet.prompts, r, promptSet.templateEngine);
          const contents = messages.map((m) => m.content);
          return contents.join('\n\n');
        })
      } else {
        const messages = getMessages(promptSet.prompts, request, promptSet.templateEngine);
        const contents = messages.map((m) => m.content);
        input = contents.join('\n\n');
      }
      const response = await llmService.fetchCompletion(model.provider, input, model.key, maxTokens, n);
      logger.debug('response:', response);
      try {
        let result;
        if (batch) {
          result = await Promise.all(response.choices.map((c) => mapReturnType(impl.returnMappingData, c.text, model.returnTypeSchema?.type === 'array')));
        } else {
          result = await mapReturnType(impl.returnMappingData, response.choices[0].text, model.returnTypeSchema?.type === 'array');
          if (impl.guardrails?.length) {
            for (const key of impl.guardrails) {
              logger.log('debug', 'guardrail: %s', key);
              const res = await guardrailsService.scan(key, result);
              if (res.error) {
                return { errors: [res.error] };
              }
              result = res.text;
            }
          }
        }
        return {
          data: {
            ...response,
            content: result,
          },
        };
      } catch (err) {
        logger.log('error', err);
        return { errors: [{ message: String(err) }] };
      }
    }

    const errors = [
      {
        message: `Unrecognized model type: ${model.type}`,
      },
    ];
    return { errors };
  };

  const executeComposition = async ({ workspaceId, username, compositionName, args, params, batch = false }) => {
    const compositionInfo = await compositionsService.getCompositionByName(workspaceId, compositionName);
    if (!compositionInfo) {
      const errors = [
        {
          message: `Composition ${compositionName} not found`,
        },
      ];
      return { errors };
    }

    const debugCallback = new DebugCallback();
    const tracingCallback = new TracingCallback({ workspaceId, username, tracesService });
    const composition = await adapter.createComposition(workspaceId, compositionInfo, [debugCallback, tracingCallback]);

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
        modelKey: params.modelKey || params.model || 'gpt-3.5-turbo',
        modelParams: {
          max_tokens: params.maxTokens,
          n: params.n,
        },
        isBatch: batch,
        workspaceId,
        username,
      });
      return { data: response };
    } catch (err) {
      const errors = [
        {
          message: String(err),
        },
      ];
      return { errors };
    }
  }

  /**
   * Current order of operation is:
   * 
   * 1. Advanced JSON Path Template
   * 3. Simple Mapping
   * 
   * @param {*} mappingTemplate 
   * @param {*} ret 
   * @returns 
   */
  const mapReturnType = async (mappingTemplate, ret, isArrayType) => {
    // logger.debug('ret:', ret);
    let response;
    if (!isEmpty(mappingTemplate)) {
      mappingTemplate = mappingTemplate.trim();
      logger.log('debug', 'mappingTemplate: ', mappingTemplate, ' ', typeof mappingTemplate);
      const template = eval(`(${mappingTemplate})`);
      // logger.debug('template:', template, typeof template);
      if (isArrayType) {
        // Looks like `mapEntries/mapEntriesAsync` was planned but not built
        // response = await mapEntriesAsync(ret, template);
        const promises = ret.map((val) => mapJsonAsync(val, template));
        response = Promise.all(promises);
      } else {
        response = await mapJsonAsync(ret, template);
      }
    } else {

      response = ret;
    }
    logger.debug('response:', response);

    return response;
  };

  return {
    executeComposition,
    executeFunction,
  };

}