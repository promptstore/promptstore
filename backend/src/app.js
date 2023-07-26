// const FormData = require('form-data');
const Minio = require('minio');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const express = require('express');
const http = require('http');
const httpProxy = require('http-proxy');
const morgan = require('morgan');
const os = require('os');
const passport = require('passport');
const path = require('path');
const redis = require('redis');
const session = require('express-session');
const axios = require('axios');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const winston = require('winston');

const { AgentsService } = require('./services/AgentsService');
const { AppsService } = require('./services/AppsService');
const { ChatSessionsService } = require('./services/ChatSessionsService');
const { CompositionsService } = require('./services/CompositionsService');
const { ContentService } = require('./services/ContentService');
const { CrawlerService } = require('./services/CrawlerService');
const { DataSourcesService } = require('./services/DataSourcesService');
const { DocumentsService } = require('./services/DocumentsService');
const { ExecutionsService } = require('./services/ExecutionsService');
const { ExtractorService } = require('./services/ExtractorService');
const { FeatureStoreService } = require('./services/FeatureStoreService');
const { GuardrailsService } = require('./services/GuardrailsService');
const { FunctionsService } = require('./services/FunctionsService');
const { IndexesService } = require('./services/IndexesService');
const { LLMService } = require('./services/LLMService');
const { LoaderService } = require('./services/LoaderService');
const { ModelProviderService } = require('./services/ModelProviderService');
const { ModelsService } = require('./services/ModelsService');
const { ParserService } = require('./services/ParserService');
const { PromptSetsService } = require('./services/PromptSetsService');
const { SearchService } = require('./services/SearchService');
const { SettingsService } = require('./services/SettingsService');
const { SqlSourceService } = require('./services/SqlSourceService');
const { Tool } = require('./services/Tool');
const { TrainingService } = require('./services/TrainingService');
const { UploadsService } = require('./services/UploadsService');
const { UsersService } = require('./services/UsersService');
const { WorkspacesService } = require('./services/WorkspacesService');
const { getPlugins, installModules } = require('./utils');

const RedisStore = require('connect-redis')(session);

const ENV = process.env.ENV?.toLowerCase();
console.log('debug', 'ENV:', ENV);
if (ENV === 'dev') {
  dotenv.config();
}

const config = winston.config;
const logger = new winston.Logger({
  transports: [
    new (winston.transports.Console)({
      formatter: (options) => {
        // - Return string will be passed to logger.
        // - Optionally, use options.colorize(options.level, <string>) to
        //   colorize output based on the log level.
        return config.colorize(options.level, options.level.toUpperCase()) + ' ' +
          (options.message ? options.message : '') +
          (options.meta && Object.keys(options.meta).length ? '\n\t' + JSON.stringify(options.meta) : '');
      },
    }),
  ],
  level: ENV === 'dev' ? 'debug' : 'info',
});

const DOCUMENTS_PREFIX = process.env.DOCUMENTS_PREFIX || 'documents';
const FILE_BUCKET = process.env.FILE_BUCKET || 'promptstore';
const FRONTEND_DIR = process.env.FRONTEND_DIR || '../../frontend';
const IMAGES_PREFIX = process.env.IMAGES_PREFIX || 'images';
const ONESOURCE_API_URL = process.env.ONESOURCE_API_URL;
const PORT = process.env.PORT || '5000';
const SEARCH_API = process.env.SEARCH_API;

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

const basePath = __dirname;
const extractorPlugins = getPlugins(basePath, EXTRACTOR_PLUGINS, logger);
const featureStorePlugins = getPlugins(basePath, FEATURE_STORE_PLUGINS, logger);
const llmPlugins = getPlugins(basePath, LLM_PLUGINS, logger);
const loaderPlugins = getPlugins(basePath, LOADER_PLUGINS, logger);
const modelProviderPlugins = getPlugins(basePath, MODEL_PROVIDER_PLUGINS, logger);
const outputParserPlugins = getPlugins(basePath, OUTPUT_PARSER_PLUGINS, logger);
const sqlSourcePlugins = getPlugins(basePath, SQL_SOURCE_PLUGINS, logger);
const toolPlugins = getPlugins(basePath, TOOL_PLUGINS, logger);

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
      version: '0.1.0',
      description:
        'The Prompt Store manages prompts and semantic functions.',
      license: {
        name: 'Commercial',
      },
      contact: {
        name: 'Mark Mo',
        url: 'https://promptstore.devsheds.io',
        email: 'markmo@acme.com',
      },
    },
    servers: [
      {
        url: 'https://promptstore.devsheds.io',
      },
    ],
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

const pg = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT,
});

const rc = redis.createClient({
  url: `redis://${process.env.REDIS_HOST}:6379`,
  password: process.env.REDIS_PASSWORD,
  legacyMode: true,
});
rc.connect().catch(logger.error);

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

const trainingService = TrainingService({ pg, logger });

const uploadsService = UploadsService({ pg, logger });

const usersService = UsersService({ pg });

const workspacesService = WorkspacesService({ pg, logger });

const sess = {
  cookie: {},
  resave: false,
  saveUninitialized: true,
  secret: 'Data Science is a workspace sport!',
  store: new RedisStore({ client: rc }),
};

app.use(session(sess));

// These must come after `app.use(session(sess))`
app.use(passport.initialize());
app.use(passport.session());

// You can use this section to keep a smaller payload
passport.serializeUser((user, done) => {
  done(null, user);
});
passport.deserializeUser((user, done) => {
  done(null, user)
});

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

app.use(express.static(path.join(__dirname, FRONTEND_DIR, '/build/')));

app.use(cors());

const passportPlugins = getPlugins(basePath, PASSPORT_PLUGINS, logger, { app, passport, rc, usersService });

let auth;
if (passportPlugins.length) {
  Object.values(passportPlugins).map(passport.use);
  auth = passport.authenticate(Object.keys(passportPlugins), { session: false });
} {
  auth = (req, res, next) => next();  // unauthenticated
}

const guardrailPlugins = getPlugins(basePath, GUARDRAIL_PLUGINS, logger, { app, auth });

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
    trainingService,
    uploadsService,
    usersService,
    workspacesService,
  },
};

const agents = installModules('agents', options);

const specs = swaggerJsdoc(swaggerOptions);
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(specs)
);

logger.debug('Installing routes');
installModules('routes', { ...options, agents });

const parseQueryString = (str) => {
  const parts = str.split('?');
  if (parts.length > 1) {
    return parts[1];
  }
  return '';
};

// const selectProxyHost = (req) => {
//   const searchParams = new URLSearchParams(parseQueryString(req.originalUrl));
//   const tenant = searchParams.get('tenant');
//   searchParams.delete('tenant');
//   const url = 'https://' + tenant + '/' + searchParams.toString();
//   logger.debug('selectProxyHost url: ', url);
//   return url;
// };

// app.use('/api/v1', createProxyMiddleware({
//   logger: console,
//   router: selectProxyHost,
//   changeOrigin: true,
//   followRedirects: true,
//   // selfHandleResponse: true,
//   // on: {
//   //   proxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
//   //     // log original request and proxied request info
//   //     const exchange = `[DEBUG] ${req.method} ${req.path} -> ${proxyRes.req.protocol}//${proxyRes.req.host}${proxyRes.req.path} [${proxyRes.statusCode}]`;
//   //     console.log(exchange); // [DEBUG] GET / -> http://www.example.com [200]

//   //     // log complete response
//   //     const response = responseBuffer.toString('utf8');
//   //     console.log(response); // log response body

//   //     return responseBuffer;
//   //   }),
//   // },
// }));

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

// app.get('/', (req, res) => {
//   logger.debug('redirect to /home');
//   res.redirect('/home');
// });

app.get('*', (req, res) => {
  logger.debug('GET ' + req.originalUrl);
  if (ENV === 'dev') {
    logger.debug('Proxying request');
    clientProxy.web(req, res);
  } else {
    res.setHeader('Last-Modified', (new Date()).toUTCString());
    res.sendFile(path.join(__dirname, FRONTEND_DIR, '/build/index.html'));
  }
});

const server = http.createServer(app);

server.listen(PORT, () => {
  logger.info(`Server running at http://${os.hostname()}:${PORT}`);
});
