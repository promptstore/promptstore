import Minio from 'minio';
import { NativeConnection, Worker } from '@temporalio/worker';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import path from 'path';

import logger from '../logger';
import pg from '../db';
import { CallLoggingService } from '../services/CallLoggingService';
import { CompositionsService } from '../services/CompositionsService';
import { CreditCalculatorService } from '../services/CreditCalculatorService';
import { DataSourcesService } from '../services/DataSourcesService';
import { DestinationsService } from '../services/DestinationsService';
import { EvaluationsService } from '../services/EvaluationsService';
import { ExecutionsService } from '../services/ExecutionsService';
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
import { PipelinesService } from '../services/PipelinesService';
import { PromptSetsService } from '../services/PromptSetsService';
import { SecretsService } from '../services/SecretsService';
import { SqlSourceService } from '../services/SqlSourceService';
import { ToolService } from '../services/ToolService';
import { TracesService } from '../services/TracesService';
import { UploadsService } from '../services/UploadsService';
import { UsersService } from '../services/UsersService';
import { VectorStoreService } from '../services/VectorStoreService';
import { getPlugins } from '../utils';

import { createActivities } from './activities';

let ENV = process.env.ENV?.toLowerCase();
logger.debug('ENV:', ENV);
if (ENV === 'dev') {
  dotenv.config();
}

const S3_ENDPOINT = process.env.S3_ENDPOINT;
const S3_PORT = process.env.S3_PORT;
const AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY;
const AWS_SECRET_KEY = process.env.AWS_SECRET_KEY;
const TEMPORAL_URL = process.env.TEMPORAL_URL;
const TEMPORAL_NAMESPACE = process.env.TEMPORAL_NAMESPACE;

const minioOptions = {
  endPoint: S3_ENDPOINT,
  port: parseInt(S3_PORT, 10),
  useSSL: ENV !== 'dev',
  accessKey: AWS_ACCESS_KEY,
  secretKey: AWS_SECRET_KEY,
};
logger.debug('minio options:', minioOptions);
const mc = new Minio.Client(minioOptions);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const basePath = path.join(__dirname, '..');

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

const callLoggingService = CallLoggingService({ pg, logger });
const compositionsService = CompositionsService({ pg, logger });
const dataSourcesService = DataSourcesService({ pg, logger });
const destinationsService = DestinationsService({ pg, logger });
const evaluationsService = EvaluationsService({ pg, logger });
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
const secretsService = SecretsService({ pg, logger });
const sqlSourceService = SqlSourceService({ logger, registry: sqlSourcePlugins });
const tracesService = TracesService({ pg, logger });
const uploadsService = UploadsService({ pg, logger });
const usersService = UsersService({ pg, logger });
const vectorStoreService = VectorStoreService({ logger, registry: vectorStorePlugins });

const llmService = LLMService({ logger, registry: llmPlugins, services: { parserService } });

const creditCalculatorService = CreditCalculatorService({ logger });

const executionsService = ExecutionsService({
  logger,
  services: {
    compositionsService,
    creditCalculatorService,
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

executionsService.addServices({ guardrailsService, pipelinesService, toolService });

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
      callLoggingService,
      dataSourcesService,
      destinationsService,
      evaluationsService,
      executionsService,
      extractorService,
      functionsService,
      graphStoreService,
      indexesService,
      llmService,
      loaderService,
      modelsService,
      secretsService,
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
  let message;
  if (err instanceof Error) {
    message = err.message;
    if (err.stack) {
      message += '\n' + err.stack;
    }
  } else {
    message = err.toString();
  }
  console.error(message);
  process.exit(1);
});
