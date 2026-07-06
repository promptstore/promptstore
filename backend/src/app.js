import Minio from 'minio';
import bodyParser from 'body-parser';
import connectRedis from 'connect-redis';
import cors from 'cors';
import dotenv from 'dotenv';
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
import 'web-streams-polyfill/polyfill';

import pg from './db';
import initSearchIndex from './initSearchIndex';
import logger from './logger';
import { AgentNetworksService } from './services/AgentNetworksService';
import { AgentsService } from './services/AgentsService';
import { ApiKeysService } from './services/ApiKeysService';
import { AppsService } from './services/AppsService';
import { CallLoggingService } from './services/CallLoggingService';
import { ChatSessionsService } from './services/ChatSessionsService';
import { CompositionsService } from './services/CompositionsService';
import { CreditCalculatorService } from './services/CreditCalculatorService';
import { DataSourcesService } from './services/DataSourcesService';
import { DestinationsService } from './services/DestinationsService';
import { DocumentsService } from './services/DocumentsService';
import { EmailService } from './services/EmailService';
import { EvaluationsService } from './services/EvaluationsService';
import { ExecutionsService } from './services/ExecutionsService';
import { ExtractorService } from './services/ExtractorService';
import { FeatureStoreService } from './services/FeatureStoreService';
import { GraphStoreService } from './services/GraphStoreService';
import { GuardrailsService } from './services/GuardrailsService';
import { FunctionsService } from './services/FunctionsService';
import { ImagesService } from './services/ImagesService';
import { IndexesService } from './services/IndexesService';
import { LLMService } from './services/LLMService';
import { LoaderService } from './services/LoaderService';
import { MetricStoreService } from './services/MetricStoreService';
import { MirrorsService } from './services/MirrorsService';
import { ModelProviderService } from './services/ModelProviderService';
import { ModelsService } from './services/ModelsService';
import { ParserService } from './services/ParserService';
import { PipelinesService } from './services/PipelinesService.js';
import { PromptSetsService } from './services/PromptSetsService';
import { RulesEngineService } from './services/RulesEngineService';
import { RulesService } from './services/RulesService';
import { SecretsService } from './services/SecretsService';
import { SettingsService } from './services/SettingsService';
import { SqlSourceService } from './services/SqlSourceService';
import { TestCasesService } from './services/TestCasesService';
import { TestScenariosService } from './services/TestScenariosService.js';
import { ToolService } from './services/ToolService';
import { TracesService } from './services/TracesService';
import { PricingService } from './services/PricingService';
import { BudgetsService } from './services/BudgetsService';
import { InsightsService } from './services/InsightsService';
import { PostgresSpanStore } from './services/spanstore/PostgresSpanStore';
import { PostgresPayloadStore } from './services/spanstore/PayloadStore';
import { TelemetryIngestService } from './services/TelemetryIngestService';
import { TelemetryLiveBus } from './services/TelemetryLiveBus';
import { SpanReadService } from './services/SpanReadService';
import { TrainingService } from './services/TrainingService';
import { TransformationsService } from './services/TransformationsService';
import { UploadsService } from './services/UploadsService';
import { UsersService } from './services/UsersService';
import { WorkspacesService } from './services/WorkspacesService';
import { VectorStoreService } from './services/VectorStoreService';
import { getPlugins, installModules } from './utils';
import * as workflowClient from './workflow/clients';

const ENV = process.env.ENV?.toLowerCase();
logger.debug('ENV:', ENV);
if (ENV === 'dev') {
  dotenv.config();
}

const SEARCH_EMBEDDING_PROVIDER = process.env.SEARCH_EMBEDDING_PROVIDER;
const SEARCH_INDEX_NAME = process.env.SEARCH_INDEX_NAME;
const SEARCH_NODE_LABEL = process.env.SEARCH_NODE_LABEL;
const SEARCH_WORKSPACE = +process.env.SEARCH_WORKSPACE;
const SEARCH_VECTORSTORE_PROVIDER = process.env.SEARCH_VECTORSTORE_PROVIDER;

const SYSTEM_WORKSPACE_ID = +process.env.SYSTEM_WORKSPACE_ID;

const BASE_URL = process.env.BASE_URL;
const DOCUMENTS_PREFIX = process.env.DOCUMENTS_PREFIX || 'documents';
const FILE_BUCKET = process.env.FILE_BUCKET || 'promptstore';
const FRONTEND_DIR = process.env.FRONTEND_DIR || '../../frontend';
const FILESTORE_PREFIX = process.env.FILESTORE_PREFIX || process.env.HOME || '';
const IMAGES_PREFIX = process.env.IMAGES_PREFIX || 'images';
const MAILTRAP_INVITE_TEMPLATE_UUID = process.env.MAILTRAP_INVITE_TEMPLATE_UUID;
const PORT = process.env.PORT || '5000';
const S3_ENDPOINT = process.env.S3_ENDPOINT;
const S3_PORT = process.env.S3_PORT;
const TEMPORAL_URL = process.env.TEMPORAL_URL;

const MINIMAL_INSTALL = process.env.MINIMAL_INSTALL === 'true';
const NO_AUTH = process.env.NO_AUTH === 'true';
const AUTH_PROVIDER = process.env.AUTH_PROVIDER || 'none'; // 'cognito', 'firebase', 'none'

const EXTRACTOR_PLUGINS = process.env.EXTRACTOR_PLUGINS || '';
const FEATURE_STORE_PLUGINS = process.env.FEATURE_STORE_PLUGINS || '';
const GRAPH_STORE_PLUGINS = process.env.GRAPH_STORE_PLUGINS || '';
const GUARDRAIL_PLUGINS = process.env.GUARDRAIL_PLUGINS || '';
const LLM_PLUGINS = process.env.LLM_PLUGINS || '';
const LOADER_PLUGINS = process.env.LOADER_PLUGINS || '';
const METRIC_STORE_PLUGINS = process.env.METRIC_STORE_PLUGINS || '';
const MODEL_PROVIDER_PLUGINS = process.env.MODEL_PROVIDER_PLUGINS || '';
const OUTPUT_PARSER_PLUGINS = process.env.OUTPUT_PARSER_PLUGINS || '';
const PASSPORT_PLUGINS = process.env.PASSPORT_PLUGINS || '';
const SQL_SOURCE_PLUGINS = process.env.SQL_SOURCE_PLUGINS || '';
const TOOL_PLUGINS = process.env.TOOL_PLUGINS || '';
const VECTOR_STORE_PLUGINS = process.env.VECTOR_STORE_PLUGINS || '';

const basePath = path.dirname(fileURLToPath(import.meta.url));
const extractorPlugins = await getPlugins(basePath, EXTRACTOR_PLUGINS, logger);
const featureStorePlugins = await getPlugins(basePath, FEATURE_STORE_PLUGINS, logger);
const graphStorePlugins = await getPlugins(basePath, GRAPH_STORE_PLUGINS, logger);
const llmPlugins = await getPlugins(basePath, LLM_PLUGINS, logger);
const loaderPlugins = await getPlugins(basePath, LOADER_PLUGINS, logger);
const metricStorePlugins = await getPlugins(basePath, METRIC_STORE_PLUGINS, logger);
const modelProviderPlugins = await getPlugins(basePath, MODEL_PROVIDER_PLUGINS, logger);
const outputParserPlugins = await getPlugins(basePath, OUTPUT_PARSER_PLUGINS, logger);
const sqlSourcePlugins = await getPlugins(basePath, SQL_SOURCE_PLUGINS, logger);
const vectorStorePlugins = await getPlugins(basePath, VECTOR_STORE_PLUGINS, logger);

const app = express();

app.disable('etag'); // prevent 304s

let apis;
if (ENV === 'dev') {
  apis = ['./src/routes/*.js'];
} else {
  apis = ['./routes/*.js'];
}

process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled rejection at:', p, 'reason:', reason);
});

process.on('uncaughtException', error => {
  console.error('Caught exception:', error);
  console.error('Exception origin:', error.stack);
});

const swaggerOptions = {
  failOnErrors: true,
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Prompt Store API',
      version: '0.5.7',
      description: 'The Prompt Store manages prompts and semantic functions.',
      license: {
        name: '',
      },
      contact: {
        name: 'Europa Labs Pty. Ltd.',
        url: 'https://promptstore.dev',
      },
    },
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'apikey',
        },
      },
    },
    security: [
      {
        ApiKeyAuth: [],
      },
    ],
  },
  apis,
};

let mc, rc;
if (!MINIMAL_INSTALL) {
  const minioOptions = {
    endPoint: S3_ENDPOINT,
    port: parseInt(S3_PORT, 10),
    useSSL: ENV !== 'dev',
    accessKey: process.env.AWS_ACCESS_KEY,
    secretKey: process.env.AWS_SECRET_KEY,
  };
  logger.debug('minio options:', minioOptions);
  mc = new Minio.Client(minioOptions);

  rc = redis.createClient({
    url: `redis://${process.env.REDIS_HOST}:6379`,
    password: process.env.REDIS_PASSWORD,
    legacyMode: true,
  });
  rc.connect().catch(err => {
    logger.error(err, err.stack);
  });
}

const agentNetworksService = AgentNetworksService({ pg, logger });

const agentsService = AgentsService({ pg, logger });

const apiKeysService = ApiKeysService({ pg, logger });

const appsService = AppsService({ pg, logger });

const callLoggingService = CallLoggingService({ pg, logger });

const chatSessionsService = ChatSessionsService({ pg, logger });

const compositionsService = CompositionsService({ pg, logger });

const dataSourcesService = DataSourcesService({ pg, logger });

const destinationsService = DestinationsService({ pg, logger });

const documentsService = DocumentsService({
  constants: { FILE_BUCKET },
  logger,
  mc,
});

const evaluationsService = EvaluationsService({ pg, logger });

const emailService = EmailService({
  constants: {
    MAILTRAP_TOKEN: process.env.MAILTRAP_TOKEN,
    SENDER_EMAIL: process.env.SENDER_EMAIL,
  },
  logger,
});

const extractorService = ExtractorService({ logger, registry: extractorPlugins });

const featureStoreService = FeatureStoreService({ logger, registry: featureStorePlugins });

const functionsService = FunctionsService({ pg, logger });

const graphStoreService = GraphStoreService({ logger, registry: graphStorePlugins });

const imagesService = ImagesService({ pg, logger });

const indexesService = IndexesService({ pg, logger });

const loaderService = LoaderService({ logger, registry: loaderPlugins });

const metricStoreService = MetricStoreService({ logger, registry: metricStorePlugins });

const mirrorsService = MirrorsService({ pg, logger });

const modelProviderService = ModelProviderService({ logger, registry: modelProviderPlugins });

const modelsService = ModelsService({ pg, logger });

const parserService = ParserService({ logger, registry: outputParserPlugins });

const promptSetsService = PromptSetsService({ pg, logger });

const rulesService = RulesService({ pg, logger });

const rulesEngineService = RulesEngineService({
  constants: {
    RULES_ENGINE_SERVICE_URL: process.env.RULES_ENGINE_SERVICE_URL,
  },
  logger,
});

const secretsService = SecretsService({ pg, logger });

const settingsService = SettingsService({ pg, logger });

const sqlSourceService = SqlSourceService({ logger, registry: sqlSourcePlugins });

const testCasesService = TestCasesService({ pg, logger });

const testScenariosService = TestScenariosService({ pg, logger });

const tracesService = TracesService({ pg, logger });

const pricingService = PricingService({ logger, services: { modelsService } });

const spanStore = PostgresSpanStore({ pg, logger });

const payloadStore = PostgresPayloadStore({ pg, logger });

const telemetryLiveBus = TelemetryLiveBus({ logger });

const telemetryIngestService = TelemetryIngestService({ logger, spanStore, pricingService, livePublisher: telemetryLiveBus, payloadStore });

const spanReadService = SpanReadService({ logger, spanStore });

const budgetsService = BudgetsService({ pg, logger, spanStore });

const insightsService = InsightsService({ pg, logger, spanStore });

// Periodically close orphaned "running" spans — an abandoned run whose end event
// never arrived (e.g. a detached sub-agent worker that died) would otherwise show
// as running forever in the live view, since a trace ends only when its root span
// is closed. reapStaleSpans keys on server-side received_at, so a slow-but-live
// run keeps itself fresh and is not reaped.
const STALE_SPAN_TTL_MS = +(process.env.TELEMETRY_STALE_SPAN_TTL_MS || 10 * 60 * 1000);
const STALE_SPAN_SWEEP_MS = +(process.env.TELEMETRY_STALE_SPAN_SWEEP_MS || 60 * 1000);
setInterval(async () => {
  try {
    const { spans, traces } = await spanStore.reapStaleSpans(STALE_SPAN_TTL_MS);
    if (spans) logger.info(`telemetry reaper closed ${spans} orphaned spans across ${traces} traces`);
  } catch (err) {
    logger.warn('telemetry reaper failed:', err.message);
  }
}, STALE_SPAN_SWEEP_MS).unref();

const trainingService = TrainingService({ pg, logger });

const transformationsService = TransformationsService({ pg, logger });

const uploadsService = UploadsService({ pg, logger });

const usersService = UsersService({ pg, logger });

const workspacesService = WorkspacesService({ pg, logger });

const vectorStoreService = VectorStoreService({ logger, registry: vectorStorePlugins });

const creditCalculatorService = CreditCalculatorService({ logger, services: { modelsService } });

if (!MINIMAL_INSTALL) {
  const RedisStore = connectRedis(session);
  const sess = {
    cookie: {},
    resave: false,
    saveUninitialized: true,
    secret: 'Data Science is a team sport!',
    store: new RedisStore({ client: rc }),
  };

  app.use(session(sess));
} else {
  app.use(
    session({
      secret: 'Data Science is a team sport!',
      resave: false,
      saveUninitialized: true,
      cookie: { secure: true },
    })
  );
}

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

app.use(
  bodyParser.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
    limit: '256mb',
  })
);
app.use(
  bodyParser.urlencoded({
    extended: true,
    // verify: (req, res, buf) => {
    //   req.rawBody = buf;
    // }
    limit: '256mb',
  })
);

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
  const authHeader = req.headers.authorization;

  // Cognito JWT verification via JWKS
  if (AUTH_PROVIDER === 'cognito' && authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2) {
      const token = parts[1];
      try {
        const { verifyCognitoToken, extractUserFromToken } = await import('./config/cognito-config.js');
        const decoded = await verifyCognitoToken(token);
        const tokenUser = extractUserFromToken(decoded);
        let user = await usersService.getUser(tokenUser.email);
        if (!user) {
          // Auto-create user on first Cognito login
          user = await usersService.upsertUser(tokenUser);
        }
        req.user = {
          ...tokenUser,
          ...(user || {}),
          roles: user?.roles || tokenUser.roles,
          username: tokenUser.email,
        };
        return next();
      } catch (err) {
        logger.error('Cognito token verification failed:', err.message);
      }
    }
  }

  // Firebase token verification
  if (AUTH_PROVIDER !== 'cognito' && authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2) {
      const token = parts[1];
      const keyPath = path.join(basePath, 'config/serviceAccountKey.json');
      if (fs.existsSync(keyPath)) {
        const { default: auth } = await import('./config/firebase-config.js');
        try {
          const decodeValue = await auth.verifyIdToken(token);
          if (decodeValue) {
            const user = await usersService.getUser(decodeValue.email);
            req.user = {
              ...decodeValue,
              ...(user || {}),
              roles: user?.roles || [],
              username: decodeValue.email,
            };
            return next();
          }
        } catch (err) {
          logger.error(err, err.stack);
        }
      }
    }
  }
  if (NO_AUTH) {
    const email = req.headers.apikey;
    if (email) {
      logger.debug('email:', decodeURIComponent(email));
      const user = await usersService.getUserByEmail(decodeURIComponent(email));
      logger.debug('user:', user);
      if (user) {
        req.user = user;
        return next();
      }
    }
  } else {
    // otherwise look for api key
    const apiKey = req.headers.apikey;
    if (apiKey) {
      const resp = await workspacesService.getUsernameByApiKey(apiKey);
      let user;
      if (resp) {
        user = await usersService.getUser(resp.username);
        if (user) {
          req.user = user;
          // Bind the workspace the API key belongs to so downstream handlers
          // (e.g. telemetry ingestion) can scope writes to it rather than
          // trusting a caller-supplied workspaceId in the request body.
          req.apiKeyWorkspaceId = resp.workspaceId;
          return next();
        }
      } else if (apiKey === process.env.PROMPTSTORE_API_KEY) {
        user = await usersService.getUser('test.account@promptstore.dev');
        if (user) {
          req.user = user;
          return next();
        }
      } else {
        // hashed keys in the api_keys table (e.g. write-only telemetry keys)
        const record = await apiKeysService.getByRawKey(apiKey);
        if (record) {
          const scopes = record.scopes || [];
          const isWildcard = scopes.includes('*');
          // A scoped (non-wildcard) key may only reach the telemetry surface,
          // so a key leaked in a client bundle cannot read traces or invoke
          // functions.
          if (!isWildcard && !req.path.startsWith('/v1/telemetry')) {
            return res.status(403).json('Forbidden: key not permitted for this resource');
          }
          req.user = { username: record.username || `telemetry@ws${record.workspaceId}` };
          req.apiKeyWorkspaceId = record.workspaceId;
          req.apiKeyScopes = scopes;
          req.apiKeyType = record.type;
          return next();
        }
      }
    }
  }

  // finally send 'Not authorized' if all validation approaches fail
  return res.status(401).json('Not authorized');
};

const auth = VerifyToken;

const llmService = LLMService({ logger, registry: llmPlugins, services: { parserService } });

const executionsService = ExecutionsService({
  constants: {
    BASE_URL,
    ENV,
    FILE_BUCKET,
  },
  logger,
  mc,
  rc,
  services: {
    agentNetworksService,
    agentsService,
    compositionsService,
    creditCalculatorService,
    dataSourcesService,
    featureStoreService,
    functionsService,
    graphStoreService,
    indexesService,
    llmService,
    metricStoreService,
    modelProviderService,
    modelsService,
    parserService,
    promptSetsService,
    rulesEngineService,
    rulesService,
    settingsService,
    sqlSourceService,
    tracesService,
    usersService,
    vectorStoreService,
  },
});

const pipelinesService = PipelinesService({
  logger,
  services: {
    executionsService,
    extractorService,
    functionsService,
    graphStoreService,
    indexesService,
    llmService,
    loaderService,
    modelsService,
    uploadsService,
    vectorStoreService,
  },
});

const guardrailPlugins = await getPlugins(basePath, GUARDRAIL_PLUGINS, logger, {
  app,
  auth,
  services: {
    executionsService,
  },
});

const guardrailsService = GuardrailsService({ logger, registry: guardrailPlugins });

const toolPlugins = await getPlugins(basePath, TOOL_PLUGINS, logger, {
  services: {
    executionsService,
  },
});

const toolService = ToolService({ logger, registry: toolPlugins });

executionsService.addServices({ guardrailsService, pipelinesService, toolService });

const options = {
  app,
  auth,
  constants: {
    BASE_URL,
    DOCUMENTS_PREFIX,
    ENV,
    FILE_BUCKET,
    FILESTORE_PREFIX,
    IMAGES_PREFIX,
    MAILTRAP_INVITE_TEMPLATE_UUID,
    MINIMAL_INSTALL,
    S3_ENDPOINT,
    S3_PORT,
    SEARCH_EMBEDDING_PROVIDER,
    SEARCH_INDEX_NAME,
    SEARCH_NODE_LABEL,
    SEARCH_WORKSPACE,
    SEARCH_VECTORSTORE_PROVIDER,
    SYSTEM_WORKSPACE_ID,
    TEMPORAL_URL,
  },
  logger,
  mc,
  passport,
  pg,
  services: {
    agentNetworksService,
    agentsService,
    apiKeysService,
    appsService,
    callLoggingService,
    chatSessionsService,
    compositionsService,
    creditCalculatorService,
    dataSourcesService,
    destinationsService,
    documentsService,
    emailService,
    evaluationsService,
    executionsService,
    extractorService,
    featureStoreService,
    functionsService,
    graphStoreService,
    guardrailsService,
    imagesService,
    indexesService,
    llmService,
    loaderService,
    metricStoreService,
    mirrorsService,
    modelProviderService,
    modelsService,
    parserService,
    pipelinesService,
    promptSetsService,
    rulesEngineService,
    rulesService,
    secretsService,
    settingsService,
    sqlSourceService,
    pricingService,
    spanStore,
    payloadStore,
    telemetryIngestService,
    telemetryLiveBus,
    spanReadService,
    budgetsService,
    insightsService,
    testCasesService,
    testScenariosService,
    toolService,
    tracesService,
    trainingService,
    transformationsService,
    uploadsService,
    usersService,
    workspacesService,
    vectorStoreService,
  },
  workflowClient,
};

logger.debug('Installing agents');
const agents = await installModules('agents', options);
logger.debug('agents:', Object.keys(agents));

executionsService.addAgents(agents);

const specs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

logger.debug('Installing routes');
await installModules('routes', { ...options, agents });

if (!MINIMAL_INSTALL) {
  initSearchIndex({
    constants: {
      SEARCH_EMBEDDING_PROVIDER,
      SEARCH_INDEX_NAME,
      SEARCH_NODE_LABEL,
      SEARCH_WORKSPACE,
      SEARCH_VECTORSTORE_PROVIDER,
    },
    logger,
    services: { indexesService, llmService, vectorStoreService },
  });
}

const parseQueryString = str => {
  const parts = str.split('?');
  if (parts.length > 1) {
    return parts[1];
  }
  return '';
};

app.get('/api/v1/health', (req, res) => {
  res.status(200).send({ status: 'ok' });
});

app.get('/api/v1/*', async (req, res, next) => {
  try {
    logger.debug('originalUrl:', req.originalUrl);
    const path = req.originalUrl.split('?')[0];
    const searchParams = new URLSearchParams(parseQueryString(req.originalUrl));
    const tenant = searchParams.get('tenant');

    if (!tenant || tenant === 'null' || tenant === 'undefined') {
      res.status(400).send({ error: 'Missing required tenant query parameter.' });
      return;
    }

    searchParams.delete('tenant');
    const url = `https://${tenant}${path}?${searchParams.toString()}`;
    logger.debug('url:', url);
    const headers = {
      ...req.headers,
      host: tenant,
    };
    const resp = await axios.get(url, {
      headers,
    });
    res.send(resp.data);
  } catch (err) {
    next(err);
  }
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
//     logger.error(err.message);
//     res.send({ err });
//   }
// });

const routePaths = app._router.stack
  .map(r => {
    if (r.route) {
      const methods = Object.entries(r.route.methods)
        .filter(([_, v]) => v)
        .map(([k, _]) => k.toUpperCase());
      return `${methods.join(',')} ${r.route.path}`;
    }
    return null;
  })
  .filter(p => p !== null);
logger.debug(routePaths);

let clientProxy;
if (ENV === 'dev') {
  clientProxy = httpProxy.createProxyServer({
    target: process.env.CLIENT_DEV_URL,
    headers: {
      'Last-Modified': new Date().toUTCString(),
    },
  });
}

// Unmatched /api routes must 404, not fall into the catch-all client proxy
// below. In dev that proxy targets CLIENT_DEV_URL (the frontend), whose own
// proxy forwards /api straight back here — an unregistered/typo'd API route
// would otherwise ping-pong between the two servers, accreting headers on each
// hop until it dies as a confusing 431 instead of a clean 404.
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: 'Not found', path: req.originalUrl });
});

app.get('*', (req, res) => {
  logger.debug('GET ' + req.originalUrl);
  if (ENV === 'dev') {
    logger.debug('Proxying request');
    clientProxy.web(req, res);
  } else {
    res.setHeader('Last-Modified', new Date().toUTCString());
    res.sendFile(path.join(basePath, FRONTEND_DIR, '/build/index.html'));
  }
});

const server = http.createServer(app);

server.listen(PORT, () => {
  logger.info(`Server running at http://${os.hostname()}:${PORT}`);
});

// Reap orphaned "running" traces: an emitter that dies before its teardown
// (e.g. a detached sub-agent worker thread when its stream closes) leaves spans
// open forever, since a trace only ends when its root span gets an end event.
// Periodically close spans in traces idle longer than the TTL. Both the TTL and
// interval are env-tunable; set SPAN_REAPER_TTL_MS=0 to disable.
if (!MINIMAL_INSTALL) {
  const reaperTtlMs = Number(process.env.SPAN_REAPER_TTL_MS ?? 30 * 60 * 1000);
  const reaperIntervalMs = Number(process.env.SPAN_REAPER_INTERVAL_MS ?? 5 * 60 * 1000);
  if (reaperTtlMs > 0) {
    const runReaper = async () => {
      try {
        const { spans, traces } = await spanStore.reapStaleSpans(reaperTtlMs);
        if (spans > 0) {
          logger.warn(`Span reaper closed ${spans} orphaned span(s) across ${traces} trace(s) (idle > ${reaperTtlMs}ms)`);
        }
      } catch (err) {
        logger.error(`Span reaper failed: ${err && err.stack ? err.stack : err}`);
      }
    };
    const reaperTimer = setInterval(runReaper, reaperIntervalMs);
    reaperTimer.unref?.();  // don't keep the process alive for the timer alone
    logger.info(`Span reaper enabled (ttl=${reaperTtlMs}ms, interval=${reaperIntervalMs}ms)`);
  }
}
