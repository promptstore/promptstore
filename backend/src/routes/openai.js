const axios = require('axios');
const fs = require('fs');
const isObject = require('lodash.isobject');
const path = require('path');
const { validate } = require('jsonschema');
const { mapJsonAsync } = require('jsonpath-mapper');
const transformations = require('../transformations');

const { appendSentence, downloadImage, fillTemplate } = require('../utils');

const DEFAULT_FORMAT = 'email tag line';

const DEFAULT_JOURNEY = 'cross-sell';

const DEFAULT_NEED_STATE = 'gaming';

const DEFAULT_PRODUCT_CATEGORY = 'mobile phone';

const DEFAULT_PRODUCT = 'iPhone';

const DEFAULT_STYLE = 'humorous';

const DEFAULT_USP = 'value';

const DEFAULT_PROMPT = "Write a ${style} ${format} for a ${productCategory}. The customer is interested in ${needState} and would benefit from ${list(usp)}. Keep the message concise, witty, and human. Just return the message. Don't try to explain yourself.";

const DEFAULT_TONE_PROMPTS = [
  {
    role: 'system',
    content: 'Analyze the following text for tone of voice and style: "${placeholder}".',
  },
  {
    role: 'system',
    content: 'Show me an example of an email tag line that uses this tone of voice and style.',
  },
  {
    role: 'system',
    content: 'Apply this style and tone of voice to all future copy.',
  },
];

const DEFAULT_MAX_TOKENS = 250;

const COPY_GENERATION_SKILL = 'copy_generation';

const DEFAULT_CHAT_MODEL = 'chat-3.5-turbo';

const DEFAULT_COMPLETION_MODEL = 'text-davinci-003';

const maxTokensByFormat = {
  'card': 100,
  'email': 250,
  'email subject line': 50,
  'sms': 25,
};

module.exports = ({ app, constants, logger, mc, passport, services }) => {

  const {
    functionsService,
    gpt4allService,
    modelsService,
    openaiService,
    promptSetsService,
  } = services;

  const getMessages = (prompts, features) => prompts.map((p, i) => ({
    role: p.role || (i < prompts.length - 1 ? 'system' : 'user'),
    content: fillTemplate(isObject(p) ? p.prompt : p, features),
  }));

  const chooseMessages = (options, features) => {
    for (let prompts of options) {
      if (!prompts) continue;
      if (!Array.isArray(prompts)) {
        prompts = [prompts];
      }
      const messages = getMessages(prompts, features);
      if (messages.length) {
        return messages;
      }
    }
    return [];
  };

  const createChatCompletion = async (app, promptSet, features, model, maxTokens, n, service) => {
    const messages = chooseMessages([
      app.prompt,
      promptSet?.prompts,
      DEFAULT_PROMPT,
    ], features);


    // TODO find a better approach
    if (app.allowEmojis) {
      const last = messages[messages.length - 1];
      last.content = appendSentence(last.content, 'Include emojis where appropriate.');
    }


    // NOT CURRENTLY IN SCOPE
    if (app.toneFilename) {
      const localFilePath = `/tmp/${process.env.FILE_BUCKET}/${app.toneFilename}`;  // includes `workspaceId` prefix
      const dirname = path.dirname(localFilePath);
      await fs.promises.mkdir(dirname, { recursive: true });
      const fileStream = fs.createWriteStream(localFilePath);
      mc.getObject(process.env.FILE_BUCKET, app.toneFilename, async (err, dataStream) => {
        if (err) {
          logger.error(err);
          throw err;
        }
        dataStream.on('data', (chunk) => {
          fileStream.write(chunk);
        });
        dataStream.on('end', async () => {
          const placeholder = fs.readFileSync(localFilePath);
          const toneMessages = getMessages(DEFAULT_TONE_PROMPTS, { placeholder });
          messages.splice(messages.length - 2, 0, ...toneMessages);
        });
      });
    }


    logger.debug('messages: ', messages);

    const response = await fetchChatCompletion(messages, model, maxTokens, n, service);

    return response;
  };

  const fetchChatCompletion = async (messages, model, maxTokens, n, service) => {
    let response;
    const prompt = messages[messages.length - 1];

    if (service === 'gpt4all') {
      const input = messages.map((m) => m.content).join('\n\n');
      response = await gpt4allService.createCompletion(input, maxTokens, n);
      return response.map((c) => ({ text: c.generation, prompt }));
    }

    response = await openaiService.createChatCompletion(messages, model, maxTokens, n);
    return {
      ...response,
      choices: response.choices.map((c) => ({ ...c, prompt })),
    };
  };

  const fetchCompletion = async (input, model, maxTokens, n, service) => {
    let response;

    if (service === 'gpt4all') {
      response = await gpt4allService.createCompletion(input, maxTokens, n);
      return response.map((c) => ({ text: c.generation, prompt: input }));
    }

    // openai
    response = await openaiService.createCompletion(prompt, model, maxTokens, n);
    return {
      ...response,
      choices: response.choices.map((c) => ({ ...c, prompt: input })),
    };
  };

  const getFeaturesWithDefaults = (app) => {
    const {
      format = DEFAULT_FORMAT,
      journey = DEFAULT_JOURNEY,
      needState = DEFAULT_NEED_STATE,
      productCategory = DEFAULT_PRODUCT_CATEGORY,
      product = DEFAULT_PRODUCT,
      style = DEFAULT_STYLE,
      usp = [DEFAULT_USP],
    } = (app.features || {});

    return {
      format,
      journey,
      needState,
      productCategory,
      product,
      style,
      usp,
    };
  };

  const getLastPrompt = (promptSet) => {
    promptSet.prompts?.[promptSet.prompts.length - 1]?.prompt;
  };

  const getMaxTokens = (app, format) => {
    let maxTokens;
    if (app.maxTokens) {
      maxTokens = app.maxTokens;
    } else if (app.format) {
      maxTokens = maxTokensByFormat(format);
    }
    return maxTokens || DEFAULT_MAX_TOKENS;
  };

  // TODO should promptsets be scoped by workspace
  const getPromptSet = async (workspaceId, promptSetId) => {
    if (promptSetId) {
      return await promptSetsService.getPromptSet(promptSetId);
    }
    return await promptSetsService.getPromptSetsBySkill(COPY_GENERATION_SKILL)[0];
  };


  app.post('/api/completion', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const { app, service } = req.body;
    logger.debug('app: ', app);
    const features = getFeaturesWithDefaults(app);
    const model = app?.model || DEFAULT_CHAT_MODEL;
    const maxTokens = getMaxTokens(app, format);
    const n = app.n || 1;

    let resp = [], r, promtpSet;
    const { workspaceId, promptSetId, variations } = app;
    if (variations?.key) {
      const { key, values } = variations;
      if (key === 'prompt') {
        for (const v of values) {
          promtpSet = getPromptSet(workspaceId, v);
          r = await createChatCompletion(app, promtpSet, features, model, maxTokens, 1, service);
          resp = [...resp, r];
        }
      } else {
        promtpSet = getPromptSet(workspaceId, promptSetId);
        for (const v of values) {
          let fs = { ...features, [key]: v };
          r = await createChatCompletion(app, promtpSet, fs, model, maxTokens, 1, service);
          resp = [...resp, r];
        }
      }
    } else {
      promtpSet = getPromptSet(workspaceId, promptSetId);
      resp = await createChatCompletion(app, promtpSet, features, model, maxTokens, n, service);
    }

    res.json(resp);
  });

  app.post('/api/prompts', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const app = req.body;
    logger.debug('app: ', app);
    const features = getFeaturesWithDefaults(app);
    const promptSet = getPromptSet(app.workspaceId, app.promptSetId);
    const messages = chooseMessages([
      app.prompt,
      getLastPrompt(promptSet),
      DEFAULT_PROMPT
    ], features);
    const promptSuggestion = messages.map((message) => ({ message }));

    res.send(promptSuggestion);
  });

  app.post('/api/chat', passport.authenticate('keycloak', { session: false }), async (req, res) => {
    const { messages, model, maxTokens } = req.body;
    const completion = await openaiService.createChatCompletion(messages, model, maxTokens);

    res.json(completion);
  });


  /**
   * @openapi
   * components:
   *   schemas:
   *     FunctionInput:
   *       type: object
   *       properties:
   *         args:
   *           type: object
   *           description: Function arguments
   *         modelKey:
   *           type: string
   *           description: The model key
   */

  /**
   * @openapi
   * tags:
   *   name: SemanticFunctions
   *   description: The Semantic Functions API
   */

  /**
   * @openapi
   * /api/executions/:name:
   *   post:
   *     description: Execute a semantic function.
   *     tags: [SemanticFunctions]
   *     parameters:
   *       - name: name
   *         description: The function name
   *         in: path
   *         schema:
   *           type: string
   *     requestBody:
   *       description: The function parameters
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/FunctionInput'
   *     responses:
   *       200:
   *         description: The function result
   *       500:
   *         description: Error
   */
  app.post('/api/executions/:name', async (req, res, next) => {
    const name = req.params.name;
    const { args, params = {} } = req.body;
    const { modelId, model: modelKey } = params;

    logger.debug('args: ', args);

    const func = await functionsService.getFunctionByName(name);

    if (!func) {
      const errors = [
        {
          message: 'Function not found',
        },
      ];
      return res.status(404).send({ errors });
    }

    let validatorResult = validate(args, func.arguments, { required: true });

    if (!validatorResult.valid) {
      return res.status(500).send({ errors: validatorResult.errors });
    }

    const implementations = func.implementations;

    if (!implementations || implementations.length === 0) {
      const errors = [
        {
          message: 'No implementations defined',
        },
      ];
      return res.status(500).send({ errors });
    }

    let impl, model;
    if (modelId) {
      impl = implementations.find((m) => m.modelId === modelId);
      model = await modelsService.getModel(modelId);
    }
    if (!impl && modelKey) {
      model = await modelsService.getModelByKey(modelKey);
      impl = implementations.find((m) => m.modelId === model.id);
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
      return res.status(500).send({ errors });
    }

    const request = await mapArgs(impl, args);

    if (model.type === 'api') {

      validatorResult = validate(request, model.arguments, { required: true });

      if (!validatorResult.valid) {
        return res.status(500).send({ errors: validatorResult.errors });
      }

      const resp = await axios.post(impl.url, request);
      return res.json(resp.data);

    }

    if (model.type === 'gpt') {

      const promptSet = await promptSetsService.getPromptSet(impl.promptSetId);

      validatorResult = validate(request, promptSet.arguments, { required: true });

      if (!validatorResult.valid) {
        return res.status(500).send({ errors: validatorResult.errors });
      }

      const messages = getMessages(promptSet.prompts, request);
      const response = await fetchChatCompletion(messages, params.maxTokens || 255, params.n || 1, 'openai');
      const content = response.choices[0].message.content;
      try {
        const result = await mapReturnType(impl, content);
        return res.json(result);
      } catch (err) {
        logger.error(err);
        return res.sendStatus(500);
      }
    }

    if (model.type === 'completion') {

      const promptSet = await promptSetsService.getPromptSet(impl.promptSetId);

      validatorResult = validate(request, promptSet.arguments, { required: true });

      if (!validatorResult.valid) {
        return res.status(500).send({ errors: validatorResult.errors });
      }

      const messages = getMessages(promptSet.prompts, request);
      const input = messages.map((m) => m.content).join('\n\n');
      const response = await fetchCompletion(input, model.key, params.maxTokens || 255, params.n || 1, 'openai');
      const content = response.choices[0].message.content;
      try {
        const result = await mapReturnType(impl, content);
        return res.json(result);
      } catch (err) {
        logger.error(err);
        return res.sendStatus(500);
      }
    }

    const errors = [
      {
        message: `Unrecognized model type: ${model.type}`,
      },
    ];
    return res.status(500).send({ errors });
  });

  const mapArgs = async (impl, args) => {
    let request;

    let mappingTemplate = impl.mappingTemplate;
    if (mappingTemplate) {
      mappingTemplate = mappingTemplate.trim();
      // logger.debug('mappingTemplate: ', mappingTemplate, ' ', typeof mappingTemplate);
      const template = eval(`(${mappingTemplate})`);
      // logger.debug('template: ', template, ' ', typeof template);
      request = await mapJsonAsync(args, template);

    } else {

      const mappingData = impl.mappingData;
      if (mappingData && mappingData.length) {
        request = mappingData.reduce((a, m) => {
          a[m.target] = args[m.source];
          return a;
        }, {});
      } else {
        request = args;
      }

    }

    logger.debug('request: ', request);

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
    logger.debug('ret: ', ret);
    let response;

    let mappingTemplate = impl.mappingTemplate;
    if (mappingTemplate) {
      mappingTemplate = mappingTemplate.trim();
      logger.debug('mappingTemplate: ', mappingTemplate, ' ', typeof mappingTemplate);
      const template = eval(`(${mappingTemplate})`);
      // logger.debug('template: ', template, ' ', typeof template);
      response = await mapJsonAsync(ret, template);

    } else {

      const returnTransformation = impl.returnTransformation;
      if (returnTransformation) {
        logger.debug('Performing transformation: ', impl.returnTransformation);
        response = transformations[returnTransformation](ret);

      } else {

        const mappingData = impl.mappingData;
        if (mappingData && mappingData.length) {
          logger.debug('mappingData: ', mappingData);
          response = mappingData.reduce((a, m) => {
            a[m.target] = ret[m.source];
            return a;
          }, {});

        } else {

          response = ret;

        }
      }
    }

    logger.debug('response: ', response);

    return response;
  };



  // NOT CURRENTLY IN SCOPE

  app.post('/api/image-request', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const { sourceId, prompt, n = 1 } = req.body;
    logger.debug(`prompt: ${prompt} (${n})`);
    const response = await openaiService.createImage(prompt, n);
    const dirname = path.join('/tmp/images/', String(sourceId));
    await fs.promises.mkdir(dirname, { recursive: true });
    const promises = [];
    for (const { url } of response) {
      promises.push(saveImage(sourceId, dirname, url));
    }
    const urls = await Promise.all(promises);
    logger.debug('urls: ', urls);
    res.json(urls);
  });

  const saveImage = (sourceId, dirname, url) => {
    return new Promise(async (resolve, reject) => {
      const imageUrl = new URL(url);
      const filename = imageUrl.pathname.substring(imageUrl.pathname.lastIndexOf('/') + 1);
      const localFilePath = path.join(dirname, filename);
      logger.debug('localFilePath: ', localFilePath);
      await downloadImage(url, localFilePath);
      const metadata = {
        'Content-Type': 'image/png',
      };
      const objectName = path.join(String(sourceId), constants.IMAGES_PREFIX, filename);
      logger.debug('bucket: ', constants.FILE_BUCKET);
      logger.debug('objectName: ', objectName);
      mc.fPutObject(constants.FILE_BUCKET, objectName, localFilePath, metadata, (err, etag) => {
        if (err) {
          logger.error(err);
          return reject(err);
        }
        logger.info('File uploaded successfully.');
        mc.presignedUrl('GET', constants.FILE_BUCKET, objectName, 24 * 60 * 60, (err, presignedUrl) => {
          if (err) {
            logger.error(err);
            return reject(err);
          }
          logger.debug('presignedUrl: ', presignedUrl);
          let imageUrl;
          if (process.env.ENVIRON === 'dev') {
            const u = new URL(presignedUrl);
            imageUrl = '/api/dev/images' + u.pathname + u.search;
          } else {
            imageUrl = presignedUrl;
          }
          resolve({ imageUrl, objectName });
        });
      });
    });
  };

  app.post('/api/gen-image-variant', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const { imageUrl, n = 1 } = req.body;
    logger.debug('imageUrl:', imageUrl);
    const response = await openaiService.generateImageVariant(imageUrl, n);
    res.json(response);
  });

};