const fs = require('fs');
const path = require('path');

const { appendSentence, downloadImage, getMessages } = require('../utils');

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
    openaiService,
    promptSetsService,
    searchService,
  } = services;

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
    logger.debug('body: ', req.body);
    const { messages, model, maxTokens, indexName } = req.body;
    let hits;
    if (indexName) {
      const message = messages[messages.length - 1];
      logger.debug('q: ', message.content);
      hits = await searchService.search(indexName, message.content);
      logger.debug('hits: ', JSON.stringify(hits, null, 2));
    }
    const completion = await openaiService.createChatCompletion(messages, model, maxTokens, hits);

    res.json(completion);
  });


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
          if (process.env.ENV === 'dev') {
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

    const response = await opensiService.fetchChatCompletion(messages, model, maxTokens, n, service);

    return response;
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

};