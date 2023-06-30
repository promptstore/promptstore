// const FormData = require('form-data');
const Minio = require('minio');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const cors = require('cors');
// const { createProxyMiddleware, responseInterceptor } = require('http-proxy-middleware');
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

const { AppsService } = require('./services/AppsService');
const { CantoService } = require('./services/CantoService');
const { ChatSessionsService } = require('./services/ChatSessionsService');
const { CompositionsService } = require('./services/CompositionsService');
const { ContentService } = require('./services/ContentService');
const { CrawlerService } = require('./services/CrawlerService');
const { DataSourcesService } = require('./services/DataSourcesService');
const { DocumentsService } = require('./services/DocumentsService');
const { ExecutionsService } = require('./services/ExecutionsService');
const { FeatureStoreService } = require('./services/FeatureStoreService');
const { FunctionsService } = require('./services/FunctionsService');
const { HuggingFaceService } = require('./services/HuggingFaceService');
const { IndexesService } = require('./services/IndexesService');
const { LLMService } = require('./services/LLMService');
const { LoaderService } = require('./services/LoaderService');
const { ModelsService } = require('./services/ModelsService');
const { PIIService } = require('./services/PIIService');
const { PromptSetsService } = require('./services/PromptSetsService');
const { SearchService } = require('./services/SearchService');
const { SettingsService } = require('./services/SettingsService');
const { SqlSourceService } = require('./services/SqlSourceService');
const { Tool } = require('./services/Tool');
const { TrainingService } = require('./services/TrainingService');
const { UploadsService } = require('./services/UploadsService');
const { UsersService } = require('./services/UsersService');
const { WorkspacesService } = require('./services/WorkspacesService');
const { installRoutesDir } = require('./utils');

const RedisStore = require('connect-redis')(session);

const ENV = process.env.ENV;
console.log('debug', 'ENV: ', ENV);
if (ENV === 'dev') {
  dotenv.config();
}

const logger = new winston.Logger({
  transports: [new winston.transports.Console()],
  level: ENV === 'dev' ? 'debug' : 'info',
});

const ANAML_API_KEY = process.env.ANAML_API_KEY;
const ANAML_API_SECRET = process.env.ANAML_API_SECRET;
const ANAML_API_URL = process.env.ANAML_API_URL;
const CANTO_AUTHORIZATION_SERVER_TOKEN_URL = process.env.CANTO_AUTHORIZATION_SERVER_TOKEN_URL;
const CANTO_CLIENT_CRED_APP_ID = process.env.CANTO_CLIENT_CRED_APP_ID;
const CANTO_CLIENT_CRED_APP_SECRET = process.env.CANTO_CLIENT_CRED_APP_SECRET;
const CANTO_OAUTH_BASE_URL = process.env.CANTO_OAUTH_BASE_URL;
const CANTO_SITE_BASEURL = process.env.CANTO_SITE_BASEURL;
const CANTO_USER_FLOW_APP_ID = process.env.CANTO_USER_FLOW_APP_ID;
const CANTO_USER_FLOW_APP_SECRET = process.env.CANTO_USER_FLOW_APP_SECRET;
const DOCUMENTS_PREFIX = process.env.DOCUMENTS_PREFIX || 'documents';
const FEATURE_STORE_PLUGINS = process.env.FEATURE_STORE_PLUGINS || '';
const FILE_BUCKET = process.env.FILE_BUCKET || 'promptstore';
const FRONTEND_DIR = process.env.FRONTEND_DIR || '../../frontend';
const IMAGES_PREFIX = process.env.IMAGES_PREFIX || 'images';
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GPT4ALL_API = process.env.GPT4ALL_API;
const HUGGING_FACE_BASE_URL = process.env.HUGGING_FACE_BASE_URL;
const HUGGING_FACE_HUB_API = process.env.HUGGING_FACE_HUB_API;
const HUGGING_FACE_TOKEN = process.env.HUGGING_FACE_TOKEN;
const KEYCLOAK_CALLBACK = process.env.KEYCLOAK_CALLBACK;
const KEYCLOAK_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID;
const KEYCLOAK_CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET;
const KEYCLOAK_HOST = process.env.KEYCLOAK_HOST;
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM;
const LLM_PLUGINS = process.env.LLM_PLUGINS || '';
const LOCALAI_BASE_PATH = process.env.LOCALAI_BASE_PATH;
const ONESOURCE_API_URL = process.env.ONESOURCE_API_URL;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PII_API_URL = process.env.PII_API_URL;
const PLAETOSEQ_PII_API_URL = process.env.PLAETOSEQ_PII_API_URL;
const PORT = process.env.PORT || '5000';
const SEARCH_API = process.env.SEARCH_API;
const SERPAPI_KEY = process.env.SERPAPI_KEY;
const SERPAPI_URL = process.env.SERPAPI_URL;
const SQL_SOURCE_PLUGINS = process.env.SQL_SOURCE_PLUGINS || '';
const TOOL_PLUGINS = process.env.TOOL_PLUGINS || '';

const featureStorePlugins = FEATURE_STORE_PLUGINS.split(',').reduce((a, p) => {
  const [k, v] = p.split('|').map(e => e.trim());
  const plugin = require(v);
  logger.log('debug', 'plugin: %s - %s', k, typeof plugin);
  a[k] = plugin({
    constants: {
      ANAML_API_KEY,
      ANAML_API_SECRET,
      ANAML_API_URL,
    },
    logger,
  });
  return a;
}, {});

const llmPlugins = LLM_PLUGINS.split(',').reduce((a, p) => {
  const [k, v] = p.split('|').map(e => e.trim());
  const plugin = require(v);
  logger.log('debug', 'plugin: %s - %s', k, typeof plugin);
  a[k] = plugin({
    constants: {
      GOOGLE_API_KEY,
      GPT4ALL_API,
      LOCALAI_BASE_PATH,
      OPENAI_API_KEY,
      SERPAPI_KEY,
      SERPAPI_URL,
    },
    logger,
  });
  return a;
}, {});

const sqlSourcePlugins = SQL_SOURCE_PLUGINS.split(',').reduce((a, p) => {
  const [k, v] = p.split('|').map(e => e.trim());
  const plugin = require(v);
  logger.log('debug', 'plugin: %s - %s', k, typeof plugin);
  a[k] = plugin({
    constants: {
    },
    logger,
  });
  return a;
}, {});

const toolPlugins = TOOL_PLUGINS.split(',').reduce((a, p) => {
  const [k, v] = p.split('|').map(e => e.trim());
  const plugin = require(v);
  logger.log('debug', 'plugin: %s - %s', k, typeof plugin);
  a[k] = plugin({
    constants: {
    },
    logger,
  });
  return a;
}, {});

const app = express();

let apis;
if (ENV === 'dev') {
  app.disable('etag');
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

const appsService = AppsService({ pg, logger });

const cantoService = CantoService({
  constants: {
    CANTO_CLIENT_CRED_APP_ID,
    CANTO_CLIENT_CRED_APP_SECRET,
    CANTO_OAUTH_BASE_URL,
    CANTO_SITE_BASEURL,
    FILE_BUCKET,
    IMAGES_PREFIX,
  },
  logger,
  mc,
});

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

const featureStoreService = FeatureStoreService({ logger, registry: featureStorePlugins });

const functionsService = FunctionsService({ pg, logger });

const huggingFaceService = HuggingFaceService({
  constants: { HUGGING_FACE_BASE_URL, HUGGING_FACE_HUB_API, HUGGING_FACE_TOKEN },
  logger,
});

const indexesService = IndexesService({ pg, logger });

const llmService = LLMService({ logger, registry: llmPlugins });

const modelsService = ModelsService({ pg, logger });

const piiService = PIIService({
  constants: {
    HUGGING_FACE_TOKEN,
    PII_API_URL,
    PLAETOSEQ_PII_API_URL,
  }
});

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

const executionsService = ExecutionsService({
  logger,
  services: {
    dataSourcesService,
    featureStoreService,
    huggingFaceService,
    indexesService,
    llmService,
    modelsService,
    promptSetsService,
    searchService,
    sqlSourceService,
  },
});

const loaderService = LoaderService({
  logger,
  services: {
    documentsService,
    executionsService,
    functionsService,
    indexesService,
    searchService,
    uploadsService,
  },
});

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

const options = {
  app,
  auth: passport.authenticate(['localapikey', 'keycloak'], { session: false }),
  constants: {
    CANTO_AUTHORIZATION_SERVER_TOKEN_URL,
    CANTO_USER_FLOW_APP_ID,
    CANTO_USER_FLOW_APP_SECRET,
    DOCUMENTS_PREFIX,
    ENV,
    FILE_BUCKET,
    GPT4ALL_API,
    IMAGES_PREFIX,
    KEYCLOAK_CALLBACK,
    KEYCLOAK_CLIENT_ID,
    KEYCLOAK_CLIENT_SECRET,
    KEYCLOAK_HOST,
    KEYCLOAK_REALM,
  },
  logger,
  mc,
  passport,
  pg,
  services: {
    appsService,
    cantoService,
    chatSessionsService,
    compositionsService,
    contentService,
    crawlerService,
    dataSourcesService,
    documentsService,
    executionsService,
    featureStoreService,
    functionsService,
    huggingFaceService,
    indexesService,
    llmService,
    loaderService,
    modelsService,
    piiService,
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

const specs = swaggerJsdoc(swaggerOptions);
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(specs)
);

logger.debug('Installing routes');
installRoutesDir('routes', options, logger);

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
    res.sendFile(path.join(__dirname, FRONTEND_DIR, '/build/index.html'));
  }
});

const server = http.createServer(app);

server.listen(PORT, () => {
  logger.info(`Server running at http://${os.hostname()}:${PORT}`);
});
