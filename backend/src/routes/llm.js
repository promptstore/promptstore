import { default as dayjs } from 'dayjs';
import fs from 'fs';
import path from 'path';
import uuid from 'uuid';
import merge from 'lodash.merge';

import { PARA_DELIM } from '../core/conversions/RosettaStone';
import { Tracer } from '../core/tracing/Tracer';
import { convertMessagesWithImages, convertResponseWithImages } from '../core/utils';
import {
  downloadImage,
  fillTemplate,
  getMessages,
  isTruthy,
} from '../utils';

// const DEFAULT_CHAT_MODEL = 'chat-3.5-turbo';
// const DEFAULT_COPY_GENERATION_SKILL = 'copy_generation';
const DEFAULT_IMAGE_GENERATION_SKILL = 'image_generation';
const QA_SKILL = 'qa';
const LAST_SESSION_NAME = 'last session';


export default ({ app, auth, constants, logger, mc, services }) => {

  const {
    chatSessionsService,
    creditCalculatorService,
    executionsService,
    indexesService,
    llmService,
    modelsService,
    promptSetsService,
    tracesService,
    uploadsService,
    usersService,
    vectorStoreService,
  } = services;

  /*
  app.post('/api/completion', auth, async (req, res, next) => {
    const { username } = req.user;
    const { credits, errors } = await usersService.checkCredits(username);
    if (errors) {
      return res.status(500).json({ errors });
    }
    let creditBalance = credits;
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

    let promptSet, prompts, response = [], r;
    const { workspaceId, promptSetId, prompt, variations } = app;
    if (variations?.key) {
      const { key, values } = variations;
      if (key === 'prompt') {
        for (const id of values) {
          promptSet = await getPromptSet(workspaceId, id);
          prompts = promptSet.prompts;
          r = await createChatCompletion({ features, model, modelParams, prompts, provider });
          const { provider } = await modelsService.getModelByKey(workspaceId, r.model);
          const { prompt_tokens, completion_tokens } = r.usage || {};
          const costComponents = await creditCalculatorService.getCostComponents({
            name: `${r.model}_completion`,
            provider,
            model: r.model,
            batch: false,
            inputTokens: prompt_tokens,
            outputTokens: completion_tokens,
          });
          creditBalance -= costComponents.totalCost * 1000;
          response = [...response, r];
        }
      } else {
        if (prompt) {
          prompts = [prompt];
        } else {
          promptSet = await getPromptSet(workspaceId, promptSetId);
          prompts = promptSet.prompts;
        }
        for (const v of values) {
          const fs = { ...features, [key]: v };
          r = await createChatCompletion({ features: fs, model, modelParams, prompts, provider });
          const name = `${key}:${v}`;
          const { provider } = await modelsService.getModelByKey(workspaceId, r.model);
          const { prompt_tokens, completion_tokens } = r.usage || {};
          const costComponents = await creditCalculatorService.getCostComponents({
            name,
            provider,
            model: r.model,
            batch: false,
            inputTokens: prompt_tokens,
            outputTokens: completion_tokens,
          });
          creditBalance -= costComponents.totalCost * 1000;
          response = [...response, r];
        }
      }
    } else {
      if (prompt) {
        prompts = [prompt];
      } else {
        promptSet = await getPromptSet(workspaceId, promptSetId);
        prompts = promptSet.prompts;
      }
      if (app.models) {
        const proms = [];
        for (const model of app.models) {
          proms.push(createChatCompletion({ features, model, modelParams, prompts, provider }));
        }
        response = Promise.all(proms);
        for (const r of response) {
          const { provider } = await modelsService.getModelByKey(workspaceId, r.model);
          const { prompt_tokens, completion_tokens } = r.usage || {};
          const costComponents = await creditCalculatorService.getCostComponents({
            name: `${r.model}_completion`,
            provider,
            model: r.model,
            batch: false,
            inputTokens: prompt_tokens,
            outputTokens: completion_tokens,
          });
          creditBalance -= costComponents.totalCost * 1000;
        }
      } else {
        response = await createChatCompletion({ features, model, modelParams, prompts, provider });
        const { provider } = await modelsService.getModelByKey(workspaceId, response.model);
        const { prompt_tokens, completion_tokens } = response.usage || {};
        const costComponents = await creditCalculatorService.getCostComponents({
          name: `${response.model}_completion`,
          provider,
          model: response.model,
          batch: false,
          inputTokens: prompt_tokens,
          outputTokens: completion_tokens,
        });
        creditBalance -= costComponents.totalCost * 1000;
      }
    }
    await usersService.upsertUser({ username, credits: creditBalance });

    res.json({ response, creditBalance });
  });*/

  /*
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
  });*/

  const cleanHistory = (history) => {
    if (!history) return [];
    return history.map((m) => ({
      role: m.role,
      content: Array.isArray(m.content) ? m.content[0].content : m.content,
    }));
  };

  app.post('/api/rag/:name', auth, async (req, res) => {
    const semanticFunctionName = req.params.name;
    const { username } = req.user;
    const { batch, stream } = req.query;

    // TODO
    const {
      args,
      env,
      messages,
      history,
      params,
      workspaceId,
      extraIndexes,
      functionId,
      modelId,
      models,
      selectedTags,
    } = req.body;

    // logger.debug('models:', models);

    if (!params) params = {};
    const completions = [];
    if (models && models.length) {
      for (const model of models) {
        const { errors, response } = await executionsService.executeFunction({
          workspaceId: workspaceId || DEFAULT_WORKSPACE,
          username,
          semanticFunctionName,
          args,
          env,
          messages,
          history: cleanHistory(history),
          model,
          params,
          extraIndexes,
          batch: isTruthy(batch),
        });
        if (errors) {
          return res.status(500).json({ errors });
        }
        completions.push(response);
      }
    } else {
      const { errors, response } = await executionsService.executeFunction({
        workspaceId: workspaceId || DEFAULT_WORKSPACE,
        username,
        semanticFunctionName,
        args,
        env,
        messages,
        history: cleanHistory(history),
        params,
        extraIndexes,
        batch: isTruthy(batch),
      });
      if (errors) {
        return res.status(500).json({ errors });
      }
      completions.push(response);
    }

    const argsFormData = { ...args };
    delete argsFormData.content;
    const curMessages = [...(history || []), ...(messages || [])];
    if (args.content) {
      curMessages.push({
        role: 'user',
        content: args.content,
      });
    }
    const newMessages = [];
    // logger.debug('completions:', completions);
    for (const { choices, model } of completions) {
      let i = 0;
      for (const { message } of choices) {
        if (!newMessages[i]) {
          newMessages[i] = {
            role: message.role,
            content: [],
            citation_metadata: message.citation_metadata,
          };
        }
        newMessages[i].content.push({
          model,
          content: message.content,
        });
        i += 1;
      }
    }
    const allMessages = [...curMessages, ...newMessages];

    const lastSession = await chatSessionsService.getChatSessionByName(LAST_SESSION_NAME, username, 'rag');
    let session;
    if (lastSession) {
      session = await chatSessionsService.upsertChatSession({
        ...lastSession,
        argsFormData,
        messages: allMessages,
        modelParams: params || {},
        functionId,
        modelId,
        selectedTags,
      }, username);
    } else {
      session = await chatSessionsService.upsertChatSession({
        argsFormData,
        messages: allMessages,
        modelParams: params || {},
        name: LAST_SESSION_NAME,
        type: 'rag',
        workspaceId,
        functionId,
        modelId,
        selectedTags,
      }, username);
    }
    // logger.debug('session:', session);

    if (isTruthy(stream)) {
      const headers = {
        'Content-Type': 'text/event-stream',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache',
      };
      res.writeHead(200, headers);
      response.on('data', (data) => {
        const lines = data.toString().split('\n').filter(line => line.trim() !== '');
        for (const line of lines) {
          const message = line.replace(/^data: /, '');
          if (message === '[DONE]') {
            // Stream finished
            res.close();
          }
          try {
            const parsed = JSON.parse(message);
            res.write('data: ' + parsed.choices[0].text + '\n\n');
          } catch (error) {
            console.error('Could not JSON parse stream message', message, error);
          }
        }
      });
    } else {
      res.json({ completions, lastSession: session });
    }
  });

  app.post('/api/chat', auth, async (req, res) => {
    logger.debug('body:', req.body);
    const { username } = req.user;
    const { credits, errors } = await usersService.checkCredits(username);
    if (errors) {
      return res.status(500).json({ errors });
    }
    let creditBalance = credits;
    let {
      args,
      engine,
      history = [],
      indexName,
      isCritic,
      modelParams = {},
      originalMessages = [],
      promptSetId,
      promptSetSkill,
      systemPromptInput,
      critiquePromptSetId,
      critiquePromptInput,
      criterion,
      systemPrompt,
      textOverlay,
      subText,
      textColor,
      workspaceId,
      app,
    } = req.body;
    let messages = [];
    if (promptSetSkill) {
      const pss = await promptSetsService.getPromptSetsBySkill(workspaceId, promptSetSkill);
      const ps = pss[0];
      if (ps && ps.prompts) {
        const engine = ps.templateEngine || 'es6';
        messages = ps.prompts.map(p => {
          if (typeof p.prompt === 'string') {
            return {
              role: p.role,
              content: fillTemplate(p.prompt, args || {}, engine),
            };
          }
          return { role: p.role, content: p.prompt };
        });
      } else {
        console.error(`prompt set with skill (${promptSetSkill}) not found or has no prompts`);
      }
    }
    let models = isCritic ? modelParams.criticModels : modelParams.models;
    if (!models || !models.length) {
      // TODO move values to settings
      models = [{ model: 'gpt-4o', provider: 'openai' }];
    }

    let modelMap = {};
    for (const model of models) {
      modelMap[model.model] = await modelsService.getModelByKey(workspaceId, model.model);
    }
    const isVision = Object.values(modelMap).find(m => m.multimodal);
    const isImagegen = Object.values(modelMap).find(m => m.type === 'imagegen');

    const startTimes = [];
    let startTime = new Date();
    let endTime;
    startTimes.push(startTime);
    const traceName = ['chat', startTime.toISOString()].join(' - ');
    const tracer = new Tracer(traceName, 'chat');
    if (systemPromptInput) {
      messages.push({ role: 'system', content: systemPromptInput });
    }
    if (req.body.messages?.length) {
      // const msgs = await convertMessagesWithImages(req.body.messages);
      // messages.push(...msgs);
      messages.push(...req.body.messages);
    }
    logger.debug('!! messages:', messages);

    tracer
      .push({
        id: uuid.v4(),
        type: 'chat',
        models,
        messages,
        args,
        startTime: startTime.getTime(),
      })
      .down();

    const messageTemplates = [];
    if (systemPrompt) {
      messageTemplates.push(...systemPrompt);
    }
    messageTemplates.push(...req.body.messages);
    startTime = new Date();
    startTimes.push(startTime);
    tracer
      .push({
        id: uuid.v4(),
        type: 'call-prompt-template',
        messageTemplates: await convertMessagesWithImages(messageTemplates),
        args,
        startTime: startTime.getTime(),
      });

    let sp;

    const getContent = (content) => {
      if (typeof content === 'string') {
        return fillTemplate(content, args, engine);
      }
      return content.map(c => {
        if (c.type === 'text') {
          return { ...c, text: fillTemplate(text, args, engine) };
        }
        return c;
      });
    }

    // if (systemPrompt) {
    //   if (args) {
    //     sp = systemPrompt.map(p => ({
    //       role: p.role,
    //       content: getContent(p.content),
    //     }));
    //   } else {
    //     sp = systemPrompt;
    //   }
    // }
    // if (args) {
    //   messages.push(...req.body.messages.map(m => {
    //     let content;
    //     if (m.role === 'user' && Array.isArray(m.content)) {
    //       content = [...m.content];
    //       const index = content.findLastIndex(c => c.type === 'text');
    //       content.splice(index, 1, {
    //         type: 'text',
    //         text: fillTemplate(content[index].text, args, engine),
    //       });
    //     } else {
    //       content = fillTemplate(m.content, args, engine);
    //     }
    //     return {
    //       role: m.role,
    //       content,
    //     };
    //   }));
    // } else {
    //   messages.push(...req.body.messages);
    // }
    // sort content objects with text content at the top
    // messages = messages.map(m => {
    //   if (m.role === 'user' && Array.isArray(m.content)) {
    //     m.content.sort((a, b) => a.type > b.type ? -1 : 1);
    //   }
    //   return m;
    // });

    const outputMessages = [];
    if (sp) {
      outputMessages.push(...sp);
    }
    outputMessages.push(...messages);
    startTime = startTimes.pop();
    endTime = new Date();
    tracer
      .addProperty('endTime', endTime.getTime())
      .addProperty('elapsedMillis', endTime.getTime() - startTime.getTime())
      .addProperty('elapsedReadable', dayjs(endTime).from(startTime))
      .addProperty('messages', await convertMessagesWithImages(outputMessages))
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
        const { embeddingProvider, embeddingModel, vectorStoreProvider } = index;
        const searchParams = {};
        if (vectorStoreProvider !== 'redis' && vectorStoreProvider !== 'elasticsearch') {
          const response = await llmService.createEmbedding(embeddingProvider, {
            input: content,
            inputType: 'search_query',
            model: embeddingModel,
          });
          searchParams.queryEmbedding = response.data[0].embedding;
          const { prompt_tokens, completion_tokens } = response.usage || {};
          const costComponents = await creditCalculatorService.getCostComponents({
            name: `${indexName}_embedding`,
            provider: embeddingProvider,
            model: embeddingModel,
            batch: false,
            inputTokens: prompt_tokens,
            outputTokens: completion_tokens,
            workspaceId,
          });
          creditBalance -= costComponents.totalCost * 1000;
        }
        const hits = await vectorStoreService.search(
          vectorStoreProvider,
          indexName,
          content,
          null,  // attrs
          null,  // logicalType
          searchParams
        );
        let context;
        if (hits && hits.length) {
          context = hits.map(h => h.content_text).join(PARA_DELIM);
          const promptSets = await promptSetsService.getPromptSetsBySkill(workspaceId, QA_SKILL);
          if (promptSets.length) {
            const prompts = promptSets[0].prompts;  // use first promptSet
            const features = { content, context };
            const ctxMsgs = getMessages(prompts, features);

            // TODO what is `i`
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

    let model_params;
    if (isVision) {
      model_params = {
        max_tokens: modelParams.maxTokens,
        n: 1,
        temperature: modelParams.temperature,
      };
    } else if (isImagegen) {
      model_params = {
        n: 1,
        quality: modelParams.quality,
        responseFormat: modelParams.responseFormat,
        size: modelParams.size,
        style: modelParams.style,
        aspect_ratio: modelParams.aspect_ratio,
        negative_prompt: modelParams.negative_prompt,
        seed: modelParams.seed,
        output_format: modelParams.output_format,
        cfg_scale: modelParams.cfg_scale,
        clip_guidance_preset: modelParams.clip_guidance_preset,
        sampler: modelParams.sampler,
        samples: modelParams.samples,
        steps: modelParams.steps,
        style_preset: modelParams.style_preset,
        extras: modelParams.extras,
      };
    } else {
      model_params = {
        max_tokens: modelParams.maxTokens,
        n: 1,
        temperature: modelParams.temperature,
        top_p: modelParams.topP,
        stop: modelParams.stop,
        presence_penalty: modelParams.presencePenalty,
        frequency_penalty: modelParams.frequencyPenalty,
        top_k: modelParams.topK,
      };
    }

    const images = [];
    const prompts = [];
    const proms = [];
    for (const { model, provider } of models) {
      const prompt = {
        context: { system_prompt: sp },
        history: cleanMessages(model, history),
        messages: cleanMessages(model, messages),
      };
      prompts.push(prompt);
      const request = {
        model,
        model_params,
        prompt,
      };
      logger.debug('!! prompts:', prompts);

      startTime = new Date();
      startTimes.push(startTime);
      tracer
        .push({
          id: uuid.v4(),
          type: 'call-model',
          model,
          modelId: modelMap[model]?.id,
          modelName: modelMap[model]?.name,
          modelParams: model_params,
          prompt: {
            context: prompt.context,
            history: await convertMessagesWithImages(prompt.history),
            messages: await convertMessagesWithImages(prompt.messages),
          },
          startTime: startTime.getTime(),
        })
        .down();

      const ims = [];
      // for (const msg of prompt.messages) {
      //   if (Array.isArray(msg.content)) {
      //     for (const c of msg.content) {
      //       if (c.type === 'image_url') {
      //         const filename = c.objectName.split('/').pop();
      //         const upload = await uploadsService.getUploadByFilename(filename);
      //         let width = 1024, height = 1024;
      //         if (upload) {
      //           width = upload.width;
      //           height = upload.height;
      //         }
      //         ims.push({ width, height });
      //       }
      //     }
      //   }
      // }
      // images.push(ims);

      if (isImagegen) {
        proms.push(llmService.createImage(provider, request));
      } else {
        proms.push(llmService.createChatCompletion(provider, request));
      }
    }
    const completions = await Promise.all(proms);

    let i = 0;
    for (const completion of completions) {
      logger.debug('completion:', completion);

      startTime = startTimes.pop();
      endTime = new Date();
      tracer
        .up()
        .addProperty('endTime', endTime.getTime())
        .addProperty('elapsedMillis', endTime.getTime() - startTime.getTime())
        .addProperty('elapsedReadable', dayjs(endTime).from(startTime))
        .addProperty('response', await convertResponseWithImages(completion))
        .addProperty('success', true)
        ;
      const { provider } = modelMap[completion.model];
      const { prompt_tokens, completion_tokens } = completion.usage || {};
      const costComponents = await creditCalculatorService.getCostComponents({
        name: `${completion.model}_chat`,
        provider,
        model: completion.model,
        batch: false,
        inputTokens: prompt_tokens,
        outputTokens: completion_tokens,
        // image: images[i],
        // imageCount: images[i].length,
        workspaceId,
      });
      logger.debug('costComponents:', costComponents);
      creditBalance -= costComponents.totalCost * 1000;
      i += 0;
    }
    if (!isNaN(creditBalance)) {
      await usersService.upsertUser({ username, credits: creditBalance }, true);
    }

    startTime = startTimes.pop();
    endTime = new Date();
    const resp = completions.map(convertResponseWithImages);
    tracer
      .up()
      .addProperty('endTime', endTime.getTime())
      .addProperty('elapsedMillis', endTime.getTime() - startTime.getTime())
      .addProperty('elapsedReadable', dayjs(endTime).from(startTime))
      .addProperty('response', await Promise.all(resp))
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
          };
        }
        newMessages[i].content.push({
          model,
          content: message.content,
        });
        i += 1;
      }
    }
    const index = originalMessages.findLastIndex(m => m.role !== 'user') + 1;
    const userMessages = originalMessages.slice(index);

    // TODO why was this needed?
    // to make sure the message used as an argument is also included
    const curMessages = [...history, ...userMessages];

    const sessionType = isImagegen ? 'imagegen' : 'design';
    let session;
    if (app === 'promptstore') {
      const lastSession = await chatSessionsService.getChatSessionByName(LAST_SESSION_NAME, username, sessionType);
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
          textOverlay,
          subText,
          textColor,
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
          textOverlay,
          subText,
          textColor,
          type: sessionType,
          workspaceId,
        }, username);
      }
    }

    res.json({
      completions: completions.map((c, i) => ({ ...c, originalPrompt: prompts[i] })),
      lastSession: session,
      traceId: id,
      creditBalance,
    });
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
      if (Array.isArray(m.content)) {
        if (m.content[0].model) {
          let content;
          const modelContent = m.content.find(c => c.model === model);
          if (modelContent) {
            content = modelContent.content;
          } else {
            content = m.content[0].content;  // use content from the first model
          }
          return { ...m, content };
        }
      }
      return m;
    });
  };

  app.get('/api/providers', auth, (req, res, next) => {
    const providers = llmService.getAllProviders();
    res.json(providers);
  });

  app.get('/api/providers/embedding', auth, (req, res, next) => {
    const providers = llmService.getEmbeddingProviders();
    res.json(providers);
  });

  app.get('/api/providers/chat', auth, (req, res, next) => {
    const providers = llmService.getChatProviders();
    res.json(providers);
  });

  app.get('/api/providers/completion', auth, (req, res, next) => {
    const providers = llmService.getCompletionProviders();
    res.json(providers);
  });

  app.get('/api/providers/reranker', auth, (req, res, next) => {
    const providers = llmService.getRerankerProviders();
    res.json(providers);
  });

  app.get('/api/providers/imagegen', auth, (req, res, next) => {
    const providers = llmService.getImageProviders();
    res.json(providers);
  });

  app.post('/api/embedding', auth, async (req, res) => {
    const { username } = req.user;
    const { credits, errors } = await usersService.checkCredits(username);
    if (errors) {
      return res.status(500).json({ errors });
    }
    const { input, model, provider, workspaceId } = req.body;
    const response = await llmService.createEmbedding(provider, { model, input });
    const { prompt_tokens, completion_tokens } = response.usage || {};
    const costComponents = await creditCalculatorService.getCostComponents({
      name: model,
      provider,
      model: model,
      batch: false,
      inputTokens: prompt_tokens,
      outputTokens: completion_tokens,
      workspaceId,
    });
    const creditBalance = credits - costComponents.totalCost * 1000;
    await usersService.upsertUser({ username, credits: creditBalance }, true);
    res.json(response.data[0].embedding);
  });

  const str2num = (str) => {
    const num = +str;
    if (isNaN(num)) {
      throw new Error(`Error parsing "${str}" as number`);
    }
    return num;
  };

  const getDims = (size) => {
    try {
      const dims = size.split('x');
      if (dims.length === 2) {
        return dims.map(str2num);
      }
    } catch (err) {
      logger.error('Error parsing "%s" as dims:', size, err);
    }
    return [1024, 1024];
  }

  app.post('/api/image-request', auth, async (req, res) => {
    const { username } = req.user;
    const { credits, errors } = await usersService.checkCredits(username);
    if (errors) {
      return res.status(500).json({ errors });
    }
    logger.debug('body:', req.body);
    const {
      model,
      n,
      prompt,
      quality,
      size,
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
    logger.debug('p:', p);
    const request = {
      prompt: {
        messages: [
          {
            role: 'user',
            content: p,
          },
        ],
      },
    };
    const response = await llmService.createImage('openai', request, { model, n, quality, size });
    const [width, height] = getDims(size);
    const costComponents = creditCalculatorService.getImageCostComponents(
      model,
      'openai',
      model,
      false,
      quality,
      width,
      height,
      response
    );
    const creditBalance = credits - costComponents.totalCost * 1000;
    await usersService.upsertUser({ username, credits: creditBalance }, true);
    const dirname = path.join('/var/data/images/', String(sourceId));
    await fs.promises.mkdir(dirname, { recursive: true });
    const promises = [];
    for (const { image_url } of response.choices[0].message.content) {
      promises.push(saveImage(sourceId, dirname, image_url.url));
    }
    const urls = await Promise.all(promises);
    logger.debug('urls:', urls);
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
          let message;
          if (err instanceof Error) {
            message = err.message;
            if (err.stack) {
              message += '\n' + err.stack;
            }
          } else {
            message = err.toString();
          }
          logger.error(message);
          return reject(err);
        }
        logger.info('File uploaded successfully.');
        mc.presignedUrl('GET', constants.FILE_BUCKET, objectName, (err, presignedUrl) => {
          if (err) {
            logger.error('Error getting presigned url:', err);
            return reject(err);
          }
          logger.debug('presigned url:', presignedUrl);
          let imageUrl;
          if (constants.ENV === 'dev') {
            const u = new URL(presignedUrl);
            imageUrl = constants.BASE_URL + '/api/dev/images' + u.pathname + u.search;
          } else {
            imageUrl = presignedUrl;
          }
          resolve({ imageUrl, objectName });
        });
      });
    });
  };

  app.post('/api/gen-image-variant', auth, async (req, res, next) => {
    const { username } = req.user;
    const { credits, errors } = await usersService.checkCredits(username);
    if (errors) {
      return res.status(500).json({ errors });
    }
    const { imageUrl, n, size, workspaceId } = req.body;
    const response = await llmService.generateImageVariant('openai', imageUrl, { n, size });
    const [width, height] = getDims(size);
    // TODO - the cost model doesn't currently account for this type of request
    const costComponents = creditCalculatorService.getImageCostComponents(
      'image-variant',
      'openai',
      'image-variant',
      false,
      'standard',
      width,
      height,
      response
    );
    const creditBalance = credits - costComponents.totalCost * 1000;
    await usersService.upsertUser({ username, credits: creditBalance }, true);
    res.json(response.data);
  });

  app.post('/api/edit-image', auth, async (req, res, next) => {
    const { username } = req.user;
    const { credits, errors } = await usersService.checkCredits(username);
    if (errors) {
      return res.status(500).json({ errors });
    }
    const { imageUrl, n, prompt, size, workspaceId } = req.body;
    const response = await llmService.editImage('openai', imageUrl, prompt, { n, size });
    const [width, height] = getDims(size);
    // TODO - the cost model doesn't currently account for this type of request
    const costComponents = creditCalculatorService.getImageCostComponents(
      'image-variant',
      'openai',
      'image-variant',
      false,
      'standard',
      width,
      height,
      response
    );
    const creditBalance = credits - costComponents.totalCost * 1000;
    await usersService.upsertUser({ username, credits: creditBalance }, true);
    res.json(response.data);
  });

  // const createChatCompletion = ({ features, model, modelParams, prompts, provider }) => {
  //   const messages = getMessages(prompts, features);
  //   const request = {
  //     model,
  //     prompt: { messages },
  //     model_params: modelParams,
  //   };
  //   return llmService.createChatCompletion(provider, request);
  // };

  // const maxTokensByFormat = {
  //   'card': 100,
  //   'email': 250,
  //   'email subject line': 50,
  //   'sms': 25,
  // };

  // const getMaxTokens = (app) => {
  //   let maxTokens;
  //   if (app.maxTokens) {
  //     try {
  //       maxTokens = parseInt(app.maxTokens, 10);
  //     } catch (err) {
  //       maxTokens = DEFAULT_MAX_TOKENS;
  //     }
  //   } else if (app.format) {
  //     maxTokens = maxTokensByFormat[app.format];
  //   }
  //   return maxTokens || DEFAULT_MAX_TOKENS;
  // };

  // const getPromptSet = async (workspaceId, promptSetId) => {
  //   if (promptSetId) {
  //     const promptSet = await promptSetsService.getPromptSet(promptSetId);
  //     if (!promptSet) {
  //       throw new Error(`prompt template (${promptSetId}) not found`);
  //     }
  //     return promptSet;
  //   }
  //   const promptSets = await promptSetsService.getPromptSetsBySkill(workspaceId, DEFAULT_COPY_GENERATION_SKILL);
  //   if (!promptSets.length) {
  //     throw new Error(`prompt template (${DEFAULT_COPY_GENERATION_SKILL}) not found`);
  //   }
  //   // return first by skill
  //   return promptSets[0];
  // };

};