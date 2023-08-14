import Minio from 'minio';
import { NativeConnection, Worker } from '@temporalio/worker';
import path from 'path';
import { fileURLToPath } from 'url';

import logger from '../logger';
import pg from '../db';
import { ExtractorService } from '../services/ExtractorService';
import { UploadsService } from '../services/UploadsService';
import { getPlugins } from '../utils';

import { createActivities } from './activities';

let ENV = process.env.ENV;
logger.debug('ENV:', ENV);

const S3_ENDPOINT = process.env.S3_ENDPOINT;
const S3_PORT = process.env.S3_PORT;
const AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY;
const AWS_SECRET_KEY = process.env.AWS_SECRET_KEY;
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

const EXTRACTOR_PLUGINS = process.env.EXTRACTOR_PLUGINS || '';
const extractorPlugins = await getPlugins(basePath, EXTRACTOR_PLUGINS, logger);

const extractorService = ExtractorService({ logger, registry: extractorPlugins });
const uploadsService = UploadsService({ pg, logger });

async function runUploadsWorker() {
  const connectionOptions = {
    address: TEMPORAL_URL,
  };
  const connection = await NativeConnection.connect(connectionOptions);
  // Step 1: Register Workflows and Activities with the Worker and connect to
  // the Temporal server.
  const worker = await Worker.create({
    connection,
    workflowsPath: path.join(__dirname, 'workflows.js'),
    activities: createActivities(mc, extractorService, uploadsService, logger),
    taskQueue: 'uploads',
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

runUploadsWorker().catch((err) => {
  console.error(err);
  process.exit(1);
});


async function runReloadsWorker() {
  const connectionOptions = {
    address: TEMPORAL_URL,
  };
  const connection = await NativeConnection.connect(connectionOptions);
  // Step 1: Register Workflows and Activities with the Worker and connect to
  // the Temporal server.
  const worker = await Worker.create({
    connection,
    workflowsPath: path.join(__dirname, 'workflows.js'),
    activities: createActivities(mc, extractorService, uploadsService, logger),
    taskQueue: 'reloads',
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

runReloadsWorker().catch((err) => {
  console.error(err);
  process.exit(1);
});