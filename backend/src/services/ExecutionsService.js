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
    huggingFaceService,
    indexesService,
    llmService,
    modelsService,
    promptSetsService,
    searchService,
    sqlSourceService,
  } = services;

  const executeFunction = async (func, args, params, batch = false) => {
    logger.log('debug', 'execute function: %s', func.name);
    logger.log('debug', 'args: %s', args);
    logger.log('debug', 'params: %s', params);

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
    } = params;
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
        request = await Promise.all(args.map((a) => mapArgs(mappingTemplate, a)));
      } else {
        request = await mapArgs(mappingTemplate, args);
      }
    } else {
      logger.log('debug', 'skip argument mapping');
      request = args;
    }

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
      const values = await featureStoreService.getOnlineFeatures(ds.featurestore, params, request.entityId);
      // logger.log('debug', 'values: %s', JSON.stringify(values, null, 2));
      request = { ...request, ...values };
    }

    if (impl.indexId) {
      const index = await indexesService.getIndex(impl.indexId);

      if (!index) {
        const errors = [
          {
            message: 'Index not found',
          },
        ];
        return { errors };
      }

      const indexContentPropertyPath = impl.indexContentPropertyPath?.trim();
      const indexContextPropertyPath = impl.indexContextPropertyPath?.trim() || 'context';

      let content;
      if (!indexContentPropertyPath || indexContentPropertyPath === 'root') {
        content = request;
      } else {
        content = get(request, indexContentPropertyPath);
      }

      const res = await searchService.search(index.name, content);

      const context = res[0].content_text;
      // logger.log('debug', 'context: %s', context);

      request = set(request, indexContextPropertyPath, context);
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
        resp = await huggingFaceService.query(model.modelName, request);
      }
      logger.log('debug', 'resp: %s', resp);

      return { data: resp };
    }

    // batching doesn't work with the chat interface. a different technique is required.
    // See https://community.openai.com/t/batching-with-chatcompletion-endpoint/137723
    if (model.type === 'gpt') {

      const promptSet = await promptSetsService.getPromptSet(impl.promptSetId);

      if (promptSet.arguments) {
        validatorResult = validate(requestArgs, promptSet.arguments, { required: true });

        if (!validatorResult.valid) {
          return { errors: validatorResult.errors };
        }
      } else {
        logger.log('debug', 'skip prompt-set argument validation');
      }

      let messages;
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
      logger.log('debug', 'messages: %s', JSON.stringify(messages, null, 2));
      const response = await llmService.fetchChatCompletion(model.provider, messages, model.key, maxTokens, n);
      try {
        let result;
        if (batch) {
          result = await Promise.all(response.choices.map((c) => mapReturnType(impl, c.message.content)));
        } else {
          result = await mapReturnType(impl, response.choices[0].message.content);
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
      try {
        let result;
        if (batch) {
          result = await Promise.all(response.choices.map((c) => mapReturnType(impl, c.text)));
        } else {
          result = await mapReturnType(impl, response.choices[0].text);
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

  const mapArgs = async (mappingTemplate, args) => {
    let request;

    // let mappingTemplate = impl.mappingTemplate;
    // let mappingTemplate = impl.mappingData;
    if (!isEmpty(mappingTemplate)) {
      mappingTemplate = mappingTemplate.trim();
      logger.log('debug', 'mappingTemplate: ', mappingTemplate, ' ', typeof mappingTemplate);
      const template = eval(`(${mappingTemplate})`);
      logger.log('debug', 'template: ', template, ' ', typeof template);
      logger.log('debug', 'args: ', args, ' ', typeof args);
      request = await mapJsonAsync(args, template);

    } else {

      // const mappingData = impl.mappingData;
      // if (mappingData && mappingData.length) {
      //   request = mappingData.reduce((a, m) => {
      //     a[m.target] = args[m.source];
      //     return a;
      //   }, {});
      // } else {
      request = args;
      // }

    }

    return request;
  };

  /**
   * Current order of operation is:
   * 
   * 1. Advanced JSON Path Template
   * 2. Predefined transformation
   * 3. Simple Mapping
   * 
   * @param {*} impl 
   * @param {*} ret 
   * @returns 
   */
  const mapReturnType = async (impl, ret) => {
    logger.log('debug', 'ret: %s', ret);
    let response;

    const returnTransformation = impl.returnTransformation;
    if (returnTransformation) {
      logger.log('debug', 'Performing transformation: %s', impl.returnTransformation);
      response = transformations[returnTransformation](ret);

    } else {

      // let mappingTemplate = impl.returnMappingTemplate;
      let mappingTemplate = impl.returnMappingData;
      if (!isEmpty(mappingTemplate)) {
        mappingTemplate = mappingTemplate.trim();
        logger.log('debug', 'mappingTemplate: ', mappingTemplate, ' ', typeof mappingTemplate);
        const template = eval(`(${mappingTemplate})`);
        // logger.log('debug', 'template: ', template, ' ', typeof template);
        response = await mapJsonAsync(ret, template);

        // } else {

        //   const mappingData = impl.returnMappingData;
        //   if (mappingData && mappingData.length) {
        //     logger.log('debug', 'mappingData: %s', mappingData);
        //     response = mappingData.reduce((a, m) => {
        //       a[m.target] = ret[m.source];
        //       return a;
        //     }, {});

      } else {

        response = ret;

      }
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