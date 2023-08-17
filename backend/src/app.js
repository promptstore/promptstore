import Minio from 'minio';
import bodyParser from 'body-parser';
import connectRedis from 'connect-redis';
import cors from 'cors';
import express from 'express';
import fs from 'fs';
import http from 'http';
import httpProxy from 'http-proxy';
import morgan from 'morgan';
import os from 'os';
import passport from 'passport';
import path from 'path';
import redis from 'redis';
import session from 'express-session';
import axios from 'axios';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { fileURLToPath } from 'url';

import pg from './db';
import logger from './logger';
import { AgentsService } from './services/AgentsService';
import { AppsService } from './services/AppsService';
import { ChatSessionsService } from './services/ChatSessionsService';
import { CompositionsService } from './services/CompositionsService';
import { ContentService } from './services/ContentService';
import { CrawlerService } from './services/CrawlerService';
import { DataSourcesService } from './services/DataSourcesService';
import { DocumentsService } from './services/DocumentsService';
import { ExecutionsService } from './services/ExecutionsService';
import { ExtractorService } from './services/ExtractorService';
import { FeatureStoreService } from './services/FeatureStoreService';
import { GuardrailsService } from './services/GuardrailsService';
import { FunctionsService } from './services/FunctionsService';
import { IndexesService } from './services/IndexesService';
import { LLMService } from './services/LLMService';
import { LoaderService } from './services/LoaderService';
import { ModelProviderService } from './services/ModelProviderService';
import { ModelsService } from './services/ModelsService';
import { ParserService } from './services/ParserService';
import { PromptSetsService } from './services/PromptSetsService';
import { SearchService } from './services/SearchService';
import { SettingsService } from './services/SettingsService';
import { SqlSourceService } from './services/SqlSourceService';
import { Tool } from './services/Tool';
import { TracesService } from './services/TracesService';
import { TrainingService } from './services/TrainingService';
import { UploadsService } from './services/UploadsService';
import { UsersService } from './services/UsersService';
import { WorkspacesService } from './services/WorkspacesService';
import { getPlugins, installModules } from './utils';
import * as workflowClient from './workflow/clients';

let ENV = process.env.ENV;
logger.debug('ENV:', ENV);

const DOCUMENTS_PREFIX = process.env.DOCUMENTS_PREFIX || 'documents';
const FILE_BUCKET = process.env.FILE_BUCKET || 'promptstore';
const FRONTEND_DIR = process.env.FRONTEND_DIR || '../../frontend';
const IMAGES_PREFIX = process.env.IMAGES_PREFIX || 'images';
const ONESOURCE_API_URL = process.env.ONESOURCE_API_URL;
const PORT = process.env.PORT || '5000';
const SEARCH_API = process.env.SEARCH_API;
const TEMPORAL_URL = process.env.TEMPORAL_URL;

const EXTRACTOR_PLUGINS = process.env.EXTRACTOR_PLUGINS || '';
const FEATURE_STORE_PLUGINS = process.env.FEATURE_STORE_PLUGINS || '';
const GUARDRAIL_PLUGINS = process.env.GUARDRAIL_PLUGINS || '';
const LLM_PLUGINS = process.env.LLM_PLUGINS || '';
const LOADER_PLUGINS = process.env.LOADER_PLUGINS || '';
const MODEL_PROVIDER_PLUGINS = process.env.MODEL_PROVIDER_PLUGINS || '';
const OUTPUT_PARSER_PLUGINS = process.env.OUTPUT_PARSER_PLUGINS || '';
const PASSPORT_PLUGINS = process.env.PASSPORT_PLUGINS || '';
const SQL_SOURCE_PLUGINS = process.env.SQL_SOURCE_PLUGINS || '';
const TOOL_PLUGINS = process.env.TOOL_PLUGINS || '';

const basePath = path.dirname(fileURLToPath(import.meta.url));
const extractorPlugins = await getPlugins(basePath, EXTRACTOR_PLUGINS, logger);
const featureStorePlugins = await getPlugins(basePath, FEATURE_STORE_PLUGINS, logger);
const llmPlugins = await getPlugins(basePath, LLM_PLUGINS, logger);
const loaderPlugins = await getPlugins(basePath, LOADER_PLUGINS, logger);
const modelProviderPlugins = await getPlugins(basePath, MODEL_PROVIDER_PLUGINS, logger);
const outputParserPlugins = await getPlugins(basePath, OUTPUT_PARSER_PLUGINS, logger);
const sqlSourcePlugins = await getPlugins(basePath, SQL_SOURCE_PLUGINS, logger);
const toolPlugins = await getPlugins(basePath, TOOL_PLUGINS, logger);

const app = express();

app.disable('etag'); // prevent 304s

let apis;
if (ENV === 'dev') {
  apis = ['./src/routes/*.js'];
} else {
  apis = ['./routes/*.js'];
}

const swaggerOptions = {
  failOnErrors: true,
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Prompt Store API',
      version: '0.5.7',
      description:
        'The Prompt Store manages prompts and semantic functions.',
      license: {
        name: '',
      },
      contact: {
        name: 'Prompt Store',
        url: 'https://promptstore.dev',
      },
    }
  },
  apis,
};

const mc = new Minio.Client({
  endPoint: process.env.S3_ENDPOINT,
  port: parseInt(process.env.S3_PORT, 10),
  useSSL: false,
  accessKey: process.env.AWS_ACCESS_KEY,
  secretKey: process.env.AWS_SECRET_KEY,
});

const rc = redis.createClient({
  url: `redis://${process.env.REDIS_HOST}:6379`,
  password: process.env.REDIS_PASSWORD,
  legacyMode: true,
});
rc.connect().catch((err) => { logger.error(err, err.stack); });

const agentsService = AgentsService({ pg, logger });

const appsService = AppsService({ pg, logger });

const chatSessionsService = ChatSessionsService({ pg, logger });

const compositionsService = CompositionsService({ pg, logger });

const contentService = ContentService({ pg, logger });

const crawlerService = CrawlerService({ logger });

const dataSourcesService = DataSourcesService({ pg, logger });

const documentsService = DocumentsService({
  constants: { FILE_BUCKET, ONESOURCE_API_URL },
  logger,
  mc,
});

const extractorService = ExtractorService({ logger, registry: extractorPlugins });

const featureStoreService = FeatureStoreService({ logger, registry: featureStorePlugins });

const functionsService = FunctionsService({ pg, logger });

const indexesService = IndexesService({ pg, logger });

const llmService = LLMService({ logger, registry: llmPlugins });

const loaderService = LoaderService({ logger, registry: loaderPlugins });

const modelProviderService = ModelProviderService({ logger, registry: modelProviderPlugins });

const modelsService = ModelsService({ pg, logger });

const parserService = ParserService({ logger, registry: outputParserPlugins });

const promptSetsService = PromptSetsService({ pg, logger });

const searchService = SearchService({
  constants: { SEARCH_API },
  logger,
});

const settingsService = SettingsService({ pg, logger });

const sqlSourceService = SqlSourceService({ logger, registry: sqlSourcePlugins });

const tool = Tool({ logger, registry: toolPlugins });

const tracesService = TracesService({ pg, logger });

const trainingService = TrainingService({ pg, logger });

const uploadsService = UploadsService({ pg, logger });

const usersService = UsersService({ pg });

const workspacesService = WorkspacesService({ pg, logger });

const RedisStore = connectRedis(session);
const sess = {
  cookie: {},
  resave: false,
  saveUninitialized: true,
  secret: 'Data Science is a workspace sport!',
  store: new RedisStore({ client: rc }),
};

app.use(session(sess));

// These must come after `app.use(session(sess))`
// app.use(passport.initialize());
// app.use(passport.session());

// // You can use this section to keep a smaller payload
// passport.serializeUser((user, done) => {
//   done(null, user);
// });
// passport.deserializeUser((user, done) => {
//   done(null, user)
// });

app.use(morgan('tiny'));

app.use(bodyParser.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(bodyParser.urlencoded({
  extended: true,
  // verify: (req, res, buf) => {
  //   req.rawBody = buf;
  // }
}));

app.use(express.static(path.join(basePath, FRONTEND_DIR, '/build/')));

app.use(cors());

// const passportPlugins = await getPlugins(basePath, PASSPORT_PLUGINS, logger, { app, passport, rc, usersService });

// let auth;
// if (passportPlugins.length) {
//   Object.values(passportPlugins).map(passport.use);
//   auth = passport.authenticate(Object.keys(passportPlugins), { session: false });
// } {
//   auth = (req, res, next) => next();  // unauthenticated
// }

const VerifyToken = async (req, res, next) => {
  // look for firebase token
  const token = req.headers.authorization?.split(' ')[1];
  // logger.debug('token:', token);

  if (fs.existsSync('./config/serviceAccountKey.json')) {
    const { default: firebaseAuth } = await import('./config/firebase-config.js');
    try {
      const decodeValue = await firebaseAuth.verifyIdToken(token);
      if (decodeValue) {
        req.user = { ...decodeValue, username: decodeValue.email };
        return next();
      }
    } catch (e) {
      // return res.json({ message: 'Not authorized' });
    }
  }
  // otherwise look for api key
  const apiKey = req.headers.apikey;
  // logger.debug('apiKey:', apiKey);
  if (apiKey) {
    const resp = await workspacesService.getUsernameByApiKey(apiKey);
    // logger.debug('resp:', resp);
    let user;
    if (resp) {
      user = await usersService.getUser(resp.username);
      // logger.debug('user:', user);
      req.user = user;
      return next();
    }

    if (apiKey === process.env.PROMPTSTORE_API_KEY) {
      user = await usersService.getUser('test.account@promptstore.dev');
      req.user = user;
      return next();
    }
  }

  // finally send 'Not authorized' if both validation approaches fail
  return res.status(401).send('Not authorized');

};

const auth = VerifyToken;

const guardrailPlugins = await getPlugins(basePath, GUARDRAIL_PLUGINS, logger, { app, auth });

const guardrailsService = GuardrailsService({ logger, registry: guardrailPlugins });

const executionsService = ExecutionsService({
  logger,
  services: {
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
  },
});

const options = {
  app,
  auth,
  constants: {
    DOCUMENTS_PREFIX,
    ENV,
    FILE_BUCKET,
    IMAGES_PREFIX,
    TEMPORAL_URL,
  },
  logger,
  mc,
  passport,
  pg,
  services: {
    agentsService,
    appsService,
    chatSessionsService,
    compositionsService,
    contentService,
    crawlerService,
    dataSourcesService,
    documentsService,
    executionsService,
    extractorService,
    featureStoreService,
    functionsService,
    guardrailsService,
    indexesService,
    llmService,
    loaderService,
    modelProviderService,
    modelsService,
    parserService,
    promptSetsService,
    searchService,
    settingsService,
    sqlSourceService,
    tool,
    tracesService,
    trainingService,
    uploadsService,
    usersService,
    workspacesService,
  },
  workflowClient,
};

const agents = await installModules('agents', options);

const specs = swaggerJsdoc(swaggerOptions);
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(specs)
);

logger.debug('Installing routes');
await installModules('routes', { ...options, agents });

const parseQueryString = (str) => {
  const parts = str.split('?');
  if (parts.length > 1) {
    return parts[1];
  }
  return '';
};

app.get('/api/v1/*', async (req, res, next) => {
  logger.debug('originalUrl: ', req.originalUrl);
  const path = req.originalUrl.split('?')[0];
  const searchParams = new URLSearchParams(parseQueryString(req.originalUrl));
  const tenant = searchParams.get('tenant');
  searchParams.delete('tenant');
  const url = `https://${tenant}${path}?${searchParams.toString()}`;
  logger.debug('url: ', url);
  const headers = {
    ...req.headers,
    host: tenant,
  };
  const resp = await axios.get(url, {
    headers,
  });
  res.send(resp.data);
});

// app.use('/realms/*', async (req, res, next) => {
//   logger.debug('originalUrl: ', req.originalUrl);
//   logger.debug('method: ', req.method);
//   logger.debug('body: ', req.body);
//   logger.debug('headers: ', req.headers);
//   const path = req.originalUrl.split('?')[0];
//   const searchParams = new URLSearchParams(parseQueryString(req.originalUrl));
//   let url = `https://auth.acme.com/auth${path}?${searchParams.toString()}`;
//   logger.debug('url: ', url);
//   let data;
//   if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
//     logger.debug('form');
//     data = new FormData();
//     for (const key in req.body) {
//       data.append(key, req.body[key]);
//     }
//   } else {
//     data = req.body;
//   }
//   try {
//     const resp = await axios({
//       url,
//       method: req.method,
//       headers: req.headers,
//       data,
//       withCredentials: true,
//     });
//     res.send(resp.data);
//   } catch (err) {
//     logger.error(err);
//     res.send({ err });
//   }
// });

const routePaths = app._router.stack
  .map((r) => {
    if (r.route) {
      const methods =
        Object.entries(r.route.methods)
          .filter(([_, v]) => v)
          .map(([k, _]) => k.toUpperCase())
        ;
      return `${methods.join(',')} ${r.route.path}`;
    }
    return null;
  })
  .filter((p) => p !== null)
  ;

logger.debug(JSON.stringify(routePaths, null, 2));

let clientProxy;
if (ENV === 'dev') {
  clientProxy = httpProxy.createProxyServer({
    target: process.env.CLIENT_DEV_URL,
    headers: {
      'Last-Modified': (new Date()).toUTCString(),
    },
  })
}

app.get('*', (req, res) => {
  logger.debug('GET ' + req.originalUrl);
  if (ENV === 'dev') {
    logger.debug('Proxying request');
    clientProxy.web(req, res);
  } else {
    res.setHeader('Last-Modified', (new Date()).toUTCString());
    res.sendFile(path.join(basePath, FRONTEND_DIR, '/build/index.html'));
  }
});

const server = http.createServer(app);

server.listen(PORT, () => {
  logger.info(`Server running at http://${os.hostname()}:${PORT}`);
});
