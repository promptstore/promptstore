const axios = require('axios');
const get = require('lodash.get');
const isEmpty = require('lodash.isempty');
const isObject = require('lodash.isobject');
const merge = require('lodash.merge');
const set = require('lodash.set');
const { mapJsonAsync } = require('jsonpath-mapper');
const { validate } = require('jsonschema');

const { fillTemplate, getMessages } = require('../utils');

function ExecutionsService({ logger, services }) {

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
  } = services;

  const executeFunction = async (func, args, params, functions, batch = false) => {
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

    const funcArgs = batch ? args[0] : args;

    let validatorResult;

    if (func.arguments) {
      validatorResult = validate(funcArgs, func.arguments, { required: true });

      if (!validatorResult.valid) {
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
      return { errors };
    }
    logger.log('debug', 'model: %s', model);

    let request;
    const mappingTemplate = impl.mappingData;
    if (mappingTemplate) {
      if (batch) {
        request = await Promise.all(args.map((a) => mapArgs(mappingTemplate, a, func.arguments.type === 'array')));
      } else {
        request = await mapArgs(mappingTemplate, args, func.arguments.type === 'array');
      }
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

        let context = res.map(r => r.content_text).join('\n\n');
        // logger.log('debug', 'context: %s', context);

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
          } else {
            const { data, errors } = await executeFunction(summarizeFunc, { text: context }, {
              maxTokens: 255,
              model: 'gpt-3.5-turbo',
              n: 1,
            });
            if (errors) {
              logger.log('error', errors);
              // ignore
            } else {
              context = data.content;
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

          if (!validatorResult.valid) {
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

      if (impl.inputGuardrails?.length) {
        const text = messages.map((m) => m.content).join('\n\n');
        for (const key of impl.inputGuardrails) {
          logger.log('debug', 'guardrail: %s', key);
          const res = await guardrailsService.scan(key, text);
          if (res.error) {
            return { errors: [res.error] };
          }
        }
      }

      logger.log('debug', 'params: modelKey=%s maxTokens=%s n=%s', model.key, maxTokens, n);
      const response = await llmService.fetchChatCompletion(model.provider, messages, model.key, maxTokens, n, functions, stop);

      try {
        const contents = response.choices.map((c) => c.message.content);
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

        return {
          data: {
            ...resp,

            // TODO - some usages expect `n=1` which is not correct
            content: response.choices[0].message.content,
            result: results[0],
            functionCall: response.choices[0].message.function_call,
          }
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

  const executeGraph = async (args, params, nodes, edges) => {
    logger.log('debug', 'execute graph');
    logger.log('debug', 'args: %s', args);
    logger.log('debug', 'params: %s', params);

    const inner = async (node) => {
      // logger.log('debug', 'node: %s', node);
      if (node.type === 'requestNode') {
        return args;
      }

      const sourceIds = edges.filter((e) => e.target === node.id).map((e) => e.source);
      let res = {};
      for (const sourceId of sourceIds) {
        const sourceNode = nodes.find((n) => n.id === sourceId);
        if (!sourceNode) {
          throw new Error(`Source node (${sourceId}) not found.`);
        }
        const input = await inner(sourceNode);
        if (node.type === 'functionNode') {
          const functionId = node.data.functionId;
          const func = await functionsService.getFunction(functionId);
          const { data, errors } = await executeFunction(func, input, params);
          if (errors) {
            logger.log('error', errors);
            throw new Error();
          }
          res = merge(res, data);
        } else if (node.type === 'mapperNode') {
          const mappingData = node.data.mappingData;
          const template = eval(`(${mappingData})`);
          const data = await mapJsonAsync(input, template);
          res = merge(res, data);
        } else {
          res = merge(res, input);
        }
      }

      return res;
    };

    const output = nodes.find((n) => n.type === 'outputNode');
    if (!output) {
      return {
        error: 'No output node found',
      };
    }

    const result = await inner(output);
    return result;
  };

  const mapArgs = async (mappingTemplate, args, isArrayType) => {
    let request;
    if (!isEmpty(mappingTemplate)) {
      mappingTemplate = mappingTemplate.trim();
      // logger.log('debug', 'mappingTemplate: ', mappingTemplate, ' ', typeof mappingTemplate);
      const template = eval(`(${mappingTemplate})`);
      // logger.log('debug', 'template: ', template, ' ', typeof template);
      // logger.log('debug', 'args: ', args, ' ', typeof args);
      if (isArrayType) {
        // Looks like `mapEntries/mapEntriesAsync` was planned but not built
        // request = await mapEntriesAsync(args, template);
        const promises = args.map((val) => mapJsonAsync(val, template));
        request = Promise.all(promises);
      } else {
        request = await mapJsonAsync(args, template);
      }
    } else {

      request = args;
    }

    return request;
  };

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
    // logger.log('debug', 'ret: %s', ret);
    let response;
    if (!isEmpty(mappingTemplate)) {
      mappingTemplate = mappingTemplate.trim();
      logger.log('debug', 'mappingTemplate: ', mappingTemplate, ' ', typeof mappingTemplate);
      const template = eval(`(${mappingTemplate})`);
      // logger.log('debug', 'template: ', template, ' ', typeof template);
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
    logger.log('debug', 'response: %s', response);

    return response;
  };

  return {
    executeFunction,
    executeGraph,
  };

}

module.exports = {
  ExecutionsService,
}