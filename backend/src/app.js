const { Configuration, OpenAIApi } = require('openai');
// const FormData = require('form-data');
const Minio = require('minio');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
// const { createProxyMiddleware, responseInterceptor } = require('http-proxy-middleware');
const dotenv = require('dotenv');
const express = require('express');
const http = require('http');
const httpProxy = require('http-proxy');
const logger = require('simple-node-logger').createSimpleLogger();
const morgan = require('morgan');
const os = require('os');
const passport = require('passport');
const path = require('path');
const redis = require('redis');
const session = require('express-session');
const axios = require('axios');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// const { secured } = require('./middleware/secured');
const { AppsService } = require('./services/AppsService');
const { CantoService } = require('./services/CantoService');
const { ContentService } = require('./services/ContentService');
const { FunctionsService } = require('./services/FunctionsService');
const { Gpt4allService } = require('./services/Gpt4allService');
const { ModelsService } = require('./services/ModelsService');
const { OpenAIService } = require('./services/OpenAIService');
const { PIIService } = require('./services/PIIService');
const { PromptSetsService } = require('./services/PromptSetsService');
const { WorkspacesService } = require('./services/WorkspacesService');
const { SearchService } = require('./services/SearchService');
const { SettingsService } = require('./services/SettingsService');
const { TrainingService } = require('./services/TrainingService');
const { UsersService } = require('./services/UsersService');
const { installRoutesDir } = require('./utils');

const RedisStore = require('connect-redis')(session);

logger.setLevel('debug');

logger.debug('ENVIRON: ', process.env.ENVIRON);
if (process.env.ENVIRON === 'dev') {
  dotenv.config();
}

const CORPORA_PREFIX = process.env.CORPORA_PREFIX || 'corpora';
const FILE_BUCKET = process.env.FILE_BUCKET || 'promptstore';
const FRONTEND_DIR = process.env.FRONTEND_DIR || '../../frontend';
const IMAGES_PREFIX = process.env.IMAGES_PREFIX || 'images';
const PORT = process.env.PORT || '5000';
const GPT4ALL_API = process.env.GPT4ALL_API;
const CANTO_APP_ID = process.env.CANTO_APP_ID;
const CANTO_APP_SECRET = process.env.CANTO_APP_SECRET;
const CANTO_OAUTH_BASE_URL = process.env.CANTO_OAUTH_BASE_URL;
const CANTO_SITE_BASEURL = process.env.CANTO_SITE_BASEURL;

const app = express();

let apis;
if (process.env.ENVIRON === 'dev') {
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

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

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
    CANTO_APP_ID,
    CANTO_APP_SECRET,
    CANTO_OAUTH_BASE_URL,
    CANTO_SITE_BASEURL,
    FILE_BUCKET,
    IMAGES_PREFIX,
  },
  logger,
  mc,
});

const contentService = ContentService({ pg, logger });

const functionsService = FunctionsService({ pg, logger });

const gpt4allService = Gpt4allService({ constants: { GPT4ALL_API }, logger });

const modelsService = ModelsService({ pg, logger });

const openaiService = OpenAIService({ openai, logger });

const piiService = PIIService();

const promptSetsService = PromptSetsService({ pg, logger });

const searchService = SearchService({
  baseUrl: process.env.SEARCH_API,
  logger,
});

const settingsService = SettingsService({ pg, logger });

const trainingService = TrainingService({ pg, logger });

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

// app.use(secured);

const options = {
  app,
  constants: {
    CORPORA_PREFIX,
    FILE_BUCKET,
    GPT4ALL_API,
    IMAGES_PREFIX,
  },
  logger,
  mc,
  passport,
  pg,
  services: {
    appsService,
    cantoService,
    contentService,
    functionsService,
    gpt4allService,
    modelsService,
    openaiService,
    piiService,
    promptSetsService,
    searchService,
    settingsService,
    trainingService,
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
if (process.env.ENVIRON === 'dev') {
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
  if (process.env.ENVIRON === 'dev') {
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
