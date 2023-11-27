import { default as dayjs } from 'dayjs';
import fs from 'fs';
import path from 'path';
import uuid from 'uuid';

import { PARA_DELIM } from '../core/conversions/RosettaStone';
import { Tracer } from '../core/tracing/Tracer';
import { downloadImage, fillTemplate, getMessages } from '../utils';
import chatSessions from './chatSessions';

const DEFAULT_COPY_GENERATION_SKILL = 'copy_generation';
const DEFAULT_IMAGE_GENERATION_SKILL = 'image_generation';
const QA_SKILL = 'qa';
const LAST_SESSION_NAME = 'last session';

const DEFAULT_CHAT_MODEL = 'chat-3.5-turbo';

const maxTokensByFormat = {
  'card': 100,
  'email': 250,
  'email subject line': 50,
  'sms': 25,
};

export default ({ app, auth, constants, logger, mc, services }) => {

  const {
    chatSessionsService,
    embeddingService,
    indexesService,
    llmService,
    promptSetsService,
    tracesService,
    vectorStoreService,
  } = services;

  app.post('/api/completion', auth, async (req, res, next) => {
    const { app, service: provider } = req.body;
    // logger.debug('app:', app);
    const features = app.features;
    const model = app.model || DEFAULT_CHAT_MODEL;
    const maxTokens = getMaxTokens(app);
    const n = app.n || 1;
    const modelParams = {
      maxTokens,
      n,
    };

    let promptSet, prompts, resp = [], r;
    const { workspaceId, promptSetId, prompt, variations } = app;
    if (variations?.key) {
      const { key, values } = variations;
      if (key === 'prompt') {
        for (const id of values) {
          promptSet = getPromptSet(workspaceId, id);
          prompts = promptSet.prompts;
          r = await createChatCompletion({ features, model, modelParams, prompts, provider });
          resp = [...resp, r];
        }
      } else {
        if (prompt) {
          prompts = [prompt];
        } else {
          promptSet = getPromptSet(workspaceId, promptSetId);
          prompts = promptSet.prompts;
        }
        for (const v of values) {
          let fs = { ...features, [key]: v };
          r = await createChatCompletion({ features: fs, model, modelParams, prompts, provider });
          resp = [...resp, r];
        }
      }
    } else {
      if (prompt) {
        prompts = [prompt];
      } else {
        promptSet = getPromptSet(workspaceId, promptSetId);
        prompts = promptSet.prompts;
      }
      if (app.models) {
        const proms = [];
        for (const model of models) {
          proms.push(createChatCompletion({ features, model, modelParams, prompts, provider }));
        }
        resp = Promise.all(proms);
      } else {
        resp = await createChatCompletion({ features, model, modelParams, prompts, provider });
      }
    }

    res.json(resp);
  });

  app.post('/api/prompts', auth, async (req, res, next) => {
    const { features, promptSetId, prompt, workspaceId } = req.body;
    const promptSet = getPromptSet(workspaceId, promptSetId);
    let prompts;
    if (prompt) {
      prompts = [prompt];
    } else {
      promptSet = getPromptSet(workspaceId, promptSetId);
      prompts = promptSet.prompts;
    }
    const messages = getMessages(prompts, features);
    const promptSuggestion = messages.map((message) => ({ message }));
    res.send(promptSuggestion);
  });

  app.post('/api/chat', auth, async (req, res) => {
    logger.debug('body:', req.body);
    const { username } = req.user;
    let {
      args,
      engine,
      history,
      indexName,
      isCritic,
      modelParams,
      originalMessages,
      promptSetId,
      systemPromptInput,
      critiquePromptSetId,
      critiquePromptInput,
      criterion,
      systemPrompt,
      workspaceId,
    } = req.body;
    let models = isCritic ? modelParams.criticModels : modelParams.models;
    if (!models || !models.length) {
      // TODO move values to settings
      models = [{ model: 'gpt-3.5-turbo', provider: 'openai' }];
    }

    const startTimes = [];
    let startTime = new Date();
    let endTime;
    startTimes.push(startTime);
    const traceName = ['chat', startTime.toISOString()].join(' - ');
    const tracer = new Tracer(traceName, 'chat');
    tracer
      .push({
        id: uuid.v4(),
        type: 'chat',
        models,
        messages: req.body.messages,
        args,
        startTime: startTime.getTime(),
      })
      .down();

    const messageTemplates = [];
    if (systemPrompt) {
      messageTemplates.push({
        role: 'system',
        content: systemPrompt,
      });
    }
    messageTemplates.push(...req.body.messages);
    startTime = new Date();
    startTimes.push(startTime);
    tracer
      .push({
        id: uuid.v4(),
        type: 'call-prompt-template',
        messageTemplates,
        args,
        startTime: startTime.getTime(),
      });

    let sp;
    if (systemPrompt) {
      if (args) {
        sp = fillTemplate(systemPrompt, args, engine);
      } else {
        sp = systemPrompt;
      }
    }
    let messages;
    if (args) {
      messages = req.body.messages.map(m => ({
        role: m.role,
        content: fillTemplate(m.content, args, engine),
      }));
    } else {
      messages = req.body.messages;
    }

    const outputMessages = [];
    if (sp) {
      outputMessages.push({ role: 'system', content: sp });
    }
    outputMessages.push(...messages);
    startTime = startTimes.pop();
    endTime = new Date();
    tracer
      .addProperty('endTime', endTime.getTime())
      .addProperty('elapsedMillis', endTime.getTime() - startTime.getTime())
      .addProperty('elapsedReadable', dayjs(endTime).from(startTime))
      .addProperty('messages', outputMessages)
      .addProperty('success', true)
      ;

    // TODO place in loop
    if (indexName) {
      const message = messages[messages.length - 1];
      let content;
      if (Array.isArray(message.content)) {
        content = message.content[0].content;  // use content from the first model
      } else {
        content = message.content;
      }

      startTime = new Date();
      startTimes.push(startTime);
      tracer
        .push({
          id: uuid.v4(),
          type: 'semantic-search-enrichment',
          index: { name: indexName },
          args: { content },
          startTime: startTime.getTime(),
        });

      const index = await indexesService.getIndexByName(workspaceId, indexName);
      if (index && index.vectorStoreProvider) {
        const { embeddingProvider, vectorStoreProvider } = index;
        const searchParams = {};
        if (vectorStoreProvider === 'neo4j') {
          const queryEmbedding = await embeddingService.createEmbedding(embeddingProvider, content);
          searchParams['queryEmbedding'] = queryEmbedding;
        }
        const hits = await vectorStoreService.search(vectorStoreProvider, indexName, content, null, searchParams);
        let context;
        if (hits && hits.length) {
          context = hits.map(h => h.content_text).join(PARA_DELIM);
          const promptSets = await promptSetsService.getPromptSetsBySkill(workspaceId, QA_SKILL);
          if (promptSets.length) {
            const prompts = promptSets[0].prompts;  // use first promptSet
            const features = { content, context };
            const ctxMsgs = getMessages(prompts, features);

            // TODO what is i
            const i = 0;  // temp
            messages.splice(i, 1, ...ctxMsgs);
          }
        }
      }

      startTime = startTimes.pop();
      endTime = new Date();
      tracer
        .addProperty('endTime', endTime.getTime())
        .addProperty('elapsedMillis', endTime.getTime() - startTime.getTime())
        .addProperty('elapsedReadable', dayjs(endTime).from(startTime))
        .addProperty('enrichedArgs', { content, context })
        .addProperty('success', true)
        ;
    }

    const model_params = {
      max_tokens: modelParams.maxTokens,
      n: 1,
      temperature: modelParams.temperature,
      top_p: modelParams.topP,
      stop: modelParams.stop,
      presence_penalty: modelParams.presencePenalty,
      frequency_penalty: modelParams.frequencyPenalty,
      top_k: modelParams.topK,
    };
    const proms = [];
    for (const { model, provider } of models) {
      let request = {
        model,
        prompt: {
          context: { system_prompt: sp },
          history: cleanMessages(model, history),
          messages: cleanMessages(model, messages),
        },
        model_params,
      };

      startTime = new Date();
      startTimes.push(startTime);
      tracer
        .push({
          id: uuid.v4(),
          type: 'call-model',
          ...request,
          model,
          modelParams: model_params,
          startTime: startTime.getTime(),
        })
        .down();

      proms.push(llmService.createChatCompletion({ provider, request }));
    }
    const completions = await Promise.all(proms);

    for (const completion of completions) {
      startTime = startTimes.pop();
      endTime = new Date();
      tracer
        .up()
        .addProperty('endTime', endTime.getTime())
        .addProperty('elapsedMillis', endTime.getTime() - startTime.getTime())
        .addProperty('elapsedReadable', dayjs(endTime).from(startTime))
        .addProperty('response', completion)
        .addProperty('success', true)
        ;
    }

    startTime = startTimes.pop();
    endTime = new Date();
    tracer
      .up()
      .addProperty('endTime', endTime.getTime())
      .addProperty('elapsedMillis', endTime.getTime() - startTime.getTime())
      .addProperty('elapsedReadable', dayjs(endTime).from(startTime))
      .addProperty('response', completions)
      .addProperty('success', true)
      ;
    const traceRecord = tracer.close();
    const { id } = await tracesService.upsertTrace({ ...traceRecord, workspaceId }, username);

    const newMessages = [];
    for (const { choices, model } of completions) {
      let i = 0;
      for (const { message } of choices) {
        if (!newMessages[i]) {
          newMessages[i] = {
            role: message.role,
            content: [],
            // key: uuid.v4(),
          };
        }
        newMessages[i].content.push({
          model,
          content: message.content,
          // key: uuid.v4(),
        });
        i += 1;
      }
    }
    const userMessage = [...originalMessages].reverse().find(m => m.role === 'user');

    // TODO why was this needed?
    // to make sure the message used as an argument is also included
    const curMessages = [...history, userMessage];

    const lastSession = await chatSessionsService.getChatSessionByName(LAST_SESSION_NAME, username);
    let session;
    if (lastSession) {
      session = await chatSessionsService.upsertChatSession({
        ...lastSession,
        argsFormData: args,
        messages: [...curMessages, ...newMessages],
        modelParams,
        promptSetId,
        systemPromptInput,
        critiquePromptSetId,
        critiquePromptInput,
        criterion,
      }, username);
    } else {
      session = await chatSessionsService.upsertChatSession({
        argsFormData: args,
        messages: [...curMessages, ...newMessages],
        modelParams,
        name: LAST_SESSION_NAME,
        promptSetId,
        systemPromptInput,
        critiquePromptSetId,
        critiquePromptInput,
        criterion,
        type: 'design',
        workspaceId,
      }, username);
    }

    res.json({ completions, lastSession: session, traceId: id });
  });

  // const formatMessage = (m) => {
  //   if (Array.isArray(m.content)) {
  //     return {
  //       key: uuid.v4(),
  //       role: m.role,
  //       content: m.content.map(msg => ({
  //         key: uuid.v4(),
  //         content: msg.content,
  //         model: msg.model,
  //       })),
  //     };
  //   }
  //   return {
  //     key: uuid.v4(),
  //     role: m.role,
  //     content: m.content,
  //   };
  // }

  const cleanMessages = (model, messages) => {
    return messages.map(m => {
      let content;
      if (Array.isArray(m.content)) {
        const modelContent = m.content.find(c => c.model === model);
        if (modelContent) {
          content = modelContent.content;
        } else {
          content = m.content[0].content;  // use content from the first model
        }
      } else {
        content = m.content;
      }
      return { ...m, content };
    });
  };

  app.get('/api/providers/chat', auth, (req, res, next) => {
    const providers = llmService.getChatProviders();
    res.json(providers);
  });

  app.get('/api/providers/completion', auth, (req, res, next) => {
    const providers = llmService.getCompletionProviders();
    res.json(providers);
  });

  app.post('/api/embedding', auth, async (req, res) => {
    const { input, model, provider } = req.body;
    let embedding;
    if (provider === 'sentenceencoder') {
      embedding = await embeddingService.createEmbedding(provider, input);
    } else {
      embedding = await llmService.createEmbedding(provider, { model, input });
    }
    res.json(embedding);
  });

  app.post('/api/image-request', auth, async (req, res) => {
    logger.debug('body:', req.body);
    const {
      n,
      prompt,
      quality,
      sourceId,
      template,
      engine = 'es6',
      skill = DEFAULT_IMAGE_GENERATION_SKILL,
    } = req.body;
    let p;
    if (template) {
      p = fillTemplate(template, { content: prompt }, engine);
    } else {
      const messages = await promptSetsService.getFirstPromptSetBySkillAsMessages(sourceId, skill);
      if (messages) {
        const t = messages.map(m => m.content).join('\n\n');
        logger.debug('t:', t);
        p = fillTemplate(t, { content: prompt }, engine);
      } else {
        logger.error('image generation skill not provided and default skill not found');
        return res.sendStatus(500);
      }
    }
    const response = await llmService.createImage('openai', p, { n, quality });
    const dirname = path.join('/var/data/images/', String(sourceId));
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
      logger.debug('localFilePath:', localFilePath);
      await downloadImage(url, localFilePath);
      const metadata = {
        'Content-Type': 'image/png',
      };
      const objectName = path.join(String(sourceId), constants.IMAGES_PREFIX, filename);
      logger.debug('bucket:', constants.FILE_BUCKET);
      logger.debug('objectName:', objectName);
      mc.fPutObject(constants.FILE_BUCKET, objectName, localFilePath, metadata, (err, etag) => {
        if (err) {
          logger.error(err);
          return reject(err);
        }
        logger.info('File uploaded successfully.');
        mc.presignedUrl('GET', constants.FILE_BUCKET, objectName, 24 * 60 * 60, (err, imageUrl) => {
          if (err) {
            logger.error(err);
            return reject(err);
          }
          logger.debug('presigned url:', imageUrl);
          resolve({ imageUrl, objectName });
        });
      });
    });
  };

  app.post('/api/gen-image-variant', auth, async (req, res, next) => {
    const { imageUrl, n } = req.body;
    const response = await llmService.generateImageVariant('openai', imageUrl, { n });
    res.json(response);
  });

  const createChatCompletion = ({ features, model, modelParams, prompts, provider }) => {
    const messages = getMessages(prompts, features);
    const request = {
      model,
      prompt: { messages },
      model_params: modelParams,
    };
    return llmService.createChatCompletion({ provider, request });
  };

  const getMaxTokens = (app) => {
    let maxTokens;
    if (app.maxTokens) {
      try {
        maxTokens = parseInt(app.maxTokens, 10);
      } catch (err) {
        maxTokens = DEFAULT_MAX_TOKENS;
      }
    } else if (app.format) {
      maxTokens = maxTokensByFormat[app.format];
    }
    return maxTokens || DEFAULT_MAX_TOKENS;
  };

  const getPromptSet = async (workspaceId, promptSetId) => {
    if (promptSetId) {
      const promptSet = await promptSetsService.getPromptSet(promptSetId);
      if (!promptSet) {
        throw new Error(`PromptSet (${promptSetId}) not found`);
      }
      return promptSet;
    }
    const promptSets = promptSetsService.getPromptSetsBySkill(workspaceId, DEFAULT_COPY_GENERATION_SKILL);
    if (!promptSets.length) {
      throw new Error(`PromptSet (${DEFAULT_COPY_GENERATION_SKILL}) not found`);
    }
    // return first by skill
    return promptSets[0];
  };

};