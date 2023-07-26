const fs = require('fs');
const path = require('path');

const { appendSentence, downloadImage, getMessages } = require('../utils');

const COPY_GENERATION_SKILL = 'copy_generation';

const DEFAULT_CHAT_MODEL = 'chat-3.5-turbo';

const maxTokensByFormat = {
  'card': 100,
  'email': 250,
  'email subject line': 50,
  'sms': 25,
};

module.exports = ({ app, auth, constants, logger, mc, services }) => {

  const {
    llmService,
    promptSetsService,
    searchService,
  } = services;

  app.post('/api/completion', auth, async (req, res, next) => {
    const { app, service } = req.body;
    logger.debug('app:', app);
    const features = app.features;
    const model = app.model || DEFAULT_CHAT_MODEL;
    const maxTokens = getMaxTokens(app);
    const n = app.n || 1;

    let promptSet, prompts, resp = [], r;
    const { workspaceId, promptSetId, prompt, variations } = app;
    if (variations?.key) {
      const { key, values } = variations;
      if (key === 'prompt') {
        for (const id of values) {
          promptSet = getPromptSet(workspaceId, id);
          prompts = promptSet.prompts;
          r = await createChatCompletion(service, app, prompts, features, model, maxTokens, 1);
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
          r = await createChatCompletion(service, app, prompts, fs, model, maxTokens, 1);
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
      resp = await createChatCompletion(service, app, prompts, features, model, maxTokens, n);
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
    let { indexName, maxTokens, messages, model } = req.body;
    let hits;
    if (indexName) {
      const message = messages[messages.length - 1];
      const content = message.content;
      logger.debug('q:', content);
      hits = await searchService.search(indexName, content);
      logger.log('debug', 'hits: %s', hits);
      if (hits?.length) {
        const context = hits.map(h => h.content_text).join('\n\n');
        const promptSets = await promptSetsService.getPromptSetsBySkill('qa');
        if (promptSets.length) {
          const prompts = promptSets[0].prompts;
          const features = { content, context };
          messages.splice(i, 1, ...getMessages(prompts, features));
        }
      }
    }
    const completion = await llmService.createChatCompletion('openai', messages, model, maxTokens, 1);

    res.json(completion);
  });

  app.get('/api/providers/chat', auth, (req, res, next) => {
    const providers = llmService.getChatProviders();
    res.json(providers);
  });

  app.get('/api/providers/completion', auth, (req, res, next) => {
    const providers = llmService.getCompletionProviders();
    res.json(providers);
  });


  // NOT CURRENTLY IN SCOPE

  app.post('/api/image-request', auth, async (req, res, next) => {
    const { n = 1, prompt, sourceId } = req.body;
    const response = await llmService.createImage('openai', prompt, n);
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
        mc.presignedUrl('GET', constants.FILE_BUCKET, objectName, 24 * 60 * 60, (err, presignedUrl) => {
          if (err) {
            logger.error(err);
            return reject(err);
          }
          logger.debug('presignedUrl:', presignedUrl);
          let imageUrl;
          if (constants.ENV === 'dev') {
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

  app.post('/api/gen-image-variant', auth, async (req, res, next) => {
    const { imageUrl, n = 1 } = req.body;
    logger.debug('imageUrl:', imageUrl);
    const response = await llmService.generateImageVariant('openai', imageUrl, n);
    res.json(response);
  });

  const createChatCompletion = (provider, app, prompts, features, model, maxTokens, n) => {
    const messages = getMessages(prompts, features);

    // TODO find a better approach
    if (app.allowEmojis) {
      const last = messages[messages.length - 1];
      last.content = appendSentence(last.content, 'Use emojis judiciously.');
    }

    logger.debug('messages:', messages);

    return llmService.fetchChatCompletion(provider, messages, model, maxTokens, n);
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

  // TODO should promptsets be scoped by workspace
  const getPromptSet = async (workspaceId, promptSetId) => {
    if (promptSetId) {
      const promptSet = await promptSetsService.getPromptSet(promptSetId);
      if (!promptSet) {
        throw new Error(`PromptSet (${promptSetId}) not found`);
      }
      return promptSet;
    }
    const promptSets = promptSetsService.getPromptSetsBySkill(COPY_GENERATION_SKILL);
    if (!promptSets.length) {
      throw new Error(`PromptSet (${COPY_GENERATION_SKILL}) not found`);
    }
    // return first by skill
    return promptSets[0];
  };

};