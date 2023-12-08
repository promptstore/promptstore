import Minio from 'minio';
import { NativeConnection, Worker } from '@temporalio/worker';
import path from 'path';
import { fileURLToPath } from 'url';

import logger from '../logger';
import pg from '../db';
import { DataSourcesService } from '../services/DataSourcesService';
import { DestinationsService } from '../services/DestinationsService';
import { ExecutionsService } from '../services/ExecutionsService';
import { EmbeddingService } from '../services/EmbeddingService';
import { ExtractorService } from '../services/ExtractorService';
import { FeatureStoreService } from '../services/FeatureStoreService';
import { GraphStoreService } from '../services/GraphStoreService';
import { GuardrailsService } from '../services/GuardrailsService';
import { FunctionsService } from '../services/FunctionsService';
import { IndexesService } from '../services/IndexesService';
import { LLMService } from '../services/LLMService';
import { LoaderService } from '../services/LoaderService';
import { ModelProviderService } from '../services/ModelProviderService';
import { ModelsService } from '../services/ModelsService';
import { ParserService } from '../services/ParserService';
import { PromptSetsService } from '../services/PromptSetsService';
import { SqlSourceService } from '../services/SqlSourceService';
import { ToolService } from '../services/ToolService';
import { TracesService } from '../services/TracesService';
import { UploadsService } from '../services/UploadsService';
import { VectorStoreService } from '../services/VectorStoreService';
import { getPlugins } from '../utils';

import { createActivities } from './activities';

let ENV = process.env.ENV;
logger.debug('ENV:', ENV);

const S3_ENDPOINT = process.env.S3_ENDPOINT;
const S3_PORT = process.env.S3_PORT;
const AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY;
const AWS_SECRET_KEY = process.env.AWS_SECRET_KEY;
const SEARCH_API = process.env.SEARCH_API;
const TEMPORAL_URL = process.env.TEMPORAL_URL;
const TEMPORAL_NAMESPACE = process.env.TEMPORAL_NAMESPACE;

const mc = new Minio.Client({
  endPoint: S3_ENDPOINT,
  port: parseInt(S3_PORT, 10),
  useSSL: false,
  accessKey: AWS_ACCESS_KEY,
  secretKey: AWS_SECRET_KEY,
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const basePath = path.join(__dirname, '..');

const EMBEDDING_PLUGINS = process.env.EMBEDDING_PLUGINS || '';
const embeddingPlugins = await getPlugins(basePath, EMBEDDING_PLUGINS, logger);

const EXTRACTOR_PLUGINS = process.env.EXTRACTOR_PLUGINS || '';
const extractorPlugins = await getPlugins(basePath, EXTRACTOR_PLUGINS, logger);

const FEATURE_STORE_PLUGINS = process.env.FEATURE_STORE_PLUGINS || '';
const featureStorePlugins = await getPlugins(basePath, FEATURE_STORE_PLUGINS, logger);

const GRAPH_STORE_PLUGINS = process.env.GRAPH_STORE_PLUGINS || '';
const graphStorePlugins = await getPlugins(basePath, GRAPH_STORE_PLUGINS, logger);

const GUARDRAIL_PLUGINS = process.env.GUARDRAIL_PLUGINS || '';

const LLM_PLUGINS = process.env.LLM_PLUGINS || '';
const llmPlugins = await getPlugins(basePath, LLM_PLUGINS, logger);

const LOADER_PLUGINS = process.env.LOADER_PLUGINS || '';
const loaderPlugins = await getPlugins(basePath, LOADER_PLUGINS, logger);

const MODEL_PROVIDER_PLUGINS = process.env.MODEL_PROVIDER_PLUGINS || '';
const modelProviderPlugins = await getPlugins(basePath, MODEL_PROVIDER_PLUGINS, logger);

const OUTPUT_PARSER_PLUGINS = process.env.OUTPUT_PARSER_PLUGINS || '';
const outputParserPlugins = await getPlugins(basePath, OUTPUT_PARSER_PLUGINS, logger);

const SQL_SOURCE_PLUGINS = process.env.SQL_SOURCE_PLUGINS || '';
const sqlSourcePlugins = await getPlugins(basePath, SQL_SOURCE_PLUGINS, logger);

const TOOL_PLUGINS = process.env.TOOL_PLUGINS || '';

const VECTOR_STORE_PLUGINS = process.env.VECTOR_STORE_PLUGINS || '';
const vectorStorePlugins = await getPlugins(basePath, VECTOR_STORE_PLUGINS, logger);

const dataSourcesService = DataSourcesService({ pg, logger });
const destinationsService = DestinationsService({ pg, logger });
const embeddingService = EmbeddingService({
  logger, registry: {
    ...embeddingPlugins,
    ...llmPlugins,
  }
});
const extractorService = ExtractorService({ logger, registry: extractorPlugins });
const featureStoreService = FeatureStoreService({ logger, registry: featureStorePlugins });
const functionsService = FunctionsService({ pg, logger });
const graphStoreService = GraphStoreService({ logger, registry: graphStorePlugins });
const indexesService = IndexesService({ pg, logger });
const loaderService = LoaderService({ logger, registry: loaderPlugins });
const modelProviderService = ModelProviderService({ logger, registry: modelProviderPlugins });
const modelsService = ModelsService({ pg, logger });
const parserService = ParserService({ logger, registry: outputParserPlugins });
const promptSetsService = PromptSetsService({ pg, logger });
const sqlSourceService = SqlSourceService({ logger, registry: sqlSourcePlugins });
const tracesService = TracesService({ pg, logger });
const uploadsService = UploadsService({ pg, logger });
const vectorStoreService = VectorStoreService({ logger, registry: vectorStorePlugins });

const llmService = LLMService({ logger, registry: llmPlugins, services: { parserService } });

const executionsService = ExecutionsService({
  logger,
  services: {
    dataSourcesService,
    featureStoreService,
    functionsService,
    graphStoreService,
    indexesService,
    llmService,
    modelProviderService,
    modelsService,
    parserService,
    promptSetsService,
    sqlSourceService,
    tracesService,
    vectorStoreService,
  },
});

const guardrailPlugins = await getPlugins(basePath, GUARDRAIL_PLUGINS, logger, {
  services: {
    executionsService,
  }
});

const guardrailsService = GuardrailsService({ logger, registry: guardrailPlugins });

const toolPlugins = await getPlugins(basePath, TOOL_PLUGINS, logger, {
  services: {
    executionsService,
  }
});

const toolService = ToolService({ logger, registry: toolPlugins });

executionsService.addServices({ guardrailsService, toolService });

// async function runUploadsWorker() {
//   const connectionOptions = {
//     address: TEMPORAL_URL,
//   };
//   const connection = await NativeConnection.connect(connectionOptions);
//   // Step 1: Register Workflows and Activities with the Worker and connect to
//   // the Temporal server.
//   const worker = await Worker.create({
//     connection,
//     workflowsPath: path.join(__dirname, 'workflows.js'),
//     activities: createActivities({
//       mc,
//       dataSourcesService,
//       destinationsService,
//       executionsService,
//       extractorService,
//       functionsService,
//       sqlSourceService,
//       uploadsService,
//       logger
//     }),
//     taskQueue: 'uploads',
//     namespace: TEMPORAL_NAMESPACE || 'promptstore',
//   });
//   // Worker connects to localhost by default and uses console.error for logging.
//   // Customize the Worker by passing more options to create():
//   // https://typescript.temporal.io/api/classes/worker.Worker
//   // If you need to configure server connection parameters, see docs:
//   // https://docs.temporal.io/typescript/security#encryption-in-transit-with-mtls

//   // Step 2: Start accepting tasks on the `hello-world` queue
//   await worker.run();
// }

// runUploadsWorker().catch((err) => {
//   console.error(err);
//   process.exit(1);
// });

// async function runReloadsWorker() {
//   const connectionOptions = {
//     address: TEMPORAL_URL,
//   };
//   const connection = await NativeConnection.connect(connectionOptions);
//   // Step 1: Register Workflows and Activities with the Worker and connect to
//   // the Temporal server.
//   const worker = await Worker.create({
//     connection,
//     workflowsPath: path.join(__dirname, 'workflows.js'),
//     activities: createActivities({
//       mc,
//       dataSourcesService,
//       destinationsService,
//       executionsService,
//       extractorService,
//       functionsService,
//       sqlSourceService,
//       uploadsService,
//       logger
//     }),
//     taskQueue: 'reloads',
//     namespace: TEMPORAL_NAMESPACE || 'promptstore',
//   });
//   // Worker connects to localhost by default and uses console.error for logging.
//   // Customize the Worker by passing more options to create():
//   // https://typescript.temporal.io/api/classes/worker.Worker
//   // If you need to configure server connection parameters, see docs:
//   // https://docs.temporal.io/typescript/security#encryption-in-transit-with-mtls

//   // Step 2: Start accepting tasks on the `hello-world` queue
//   await worker.run();
// }

// runReloadsWorker().catch((err) => {
//   console.error(err);
//   process.exit(1);
// });

// async function runTransformsWorker() {
//   const connectionOptions = {
//     address: TEMPORAL_URL,
//   };
//   const connection = await NativeConnection.connect(connectionOptions);
//   // Step 1: Register Workflows and Activities with the Worker and connect to
//   // the Temporal server.
//   const worker = await Worker.create({
//     connection,
//     workflowsPath: path.join(__dirname, 'workflows.js'),
//     activities: createActivities({
//       mc,
//       dataSourcesService,
//       destinationsService,
//       executionsService,
//       extractorService,
//       functionsService,
//       sqlSourceService,
//       uploadsService,
//       logger
//     }),
//     taskQueue: 'transforms',
//     namespace: TEMPORAL_NAMESPACE || 'promptstore',
//   });
//   // Worker connects to localhost by default and uses console.error for logging.
//   // Customize the Worker by passing more options to create():
//   // https://typescript.temporal.io/api/classes/worker.Worker
//   // If you need to configure server connection parameters, see docs:
//   // https://docs.temporal.io/typescript/security#encryption-in-transit-with-mtls

//   // Step 2: Start accepting tasks on the `hello-world` queue
//   await worker.run();
// }

// runTransformsWorker().catch((err) => {
//   console.error(err);
//   process.exit(1);
// });

async function runWorker() {
  const connectionOptions = {
    address: TEMPORAL_URL,
  };
  const connection = await NativeConnection.connect(connectionOptions);
  // Step 1: Register Workflows and Activities with the Worker and connect to
  // the Temporal server.
  const worker = await Worker.create({
    connection,
    workflowsPath: path.join(__dirname, 'workflows.js'),
    activities: createActivities({
      mc,
      logger,
      dataSourcesService,
      destinationsService,
      embeddingService,
      executionsService,
      extractorService,
      functionsService,
      graphStoreService,
      indexesService,
      loaderService,
      sqlSourceService,
      uploadsService,
      vectorStoreService,
    }),
    taskQueue: 'worker',
    namespace: TEMPORAL_NAMESPACE || 'promptstore',
  });
  // Worker connects to localhost by default and uses console.error for logging.
  // Customize the Worker by passing more options to create():
  // https://typescript.temporal.io/api/classes/worker.Worker
  // If you need to configure server connection parameters, see docs:
  // https://docs.temporal.io/typescript/security#encryption-in-transit-with-mtls

  // Step 2: Start accepting tasks on the `hello-world` queue
  await worker.run();
}

runWorker().catch((err) => {
  console.error(err);
  process.exit(1);
});
