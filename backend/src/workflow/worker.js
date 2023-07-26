const { NativeConnection, Worker } = require('@temporalio/worker');
const dotenv = require('dotenv');

const pg = require('../db');
const { PromptStore } = require('../promptstore');
const { AnalysisService } = require('../services/AnalysisService');
const { ContentService } = require('../services/ContentService');

const { createActivities } = require('./activities');

console.log('ENV:', process.env.ENV);
if (process.env.ENV === 'dev') {
  dotenv.config();
}

const logger = require('../logger');

const PROMPTSTORE_BASE_URL = process.env.PROMPTSTORE_BASE_URL;
const PROMPTSTORE_KEYCLOAK_REALM = process.env.PROMPTSTORE_KEYCLOAK_REALM;
const PROMPTSTORE_KEYCLOAK_CLIENT_ID = process.env.PROMPTSTORE_KEYCLOAK_CLIENT_ID;
const PROMPTSTORE_KEYCLOAK_CLIENT_SECRET = process.env.PROMPTSTORE_KEYCLOAK_CLIENT_SECRET;
const KEYCLOAK_HOST = process.env.KEYCLOAK_HOST;

const promptStore = new PromptStore({
  constants: {
    PROMPTSTORE_BASE_URL,
    PROMPTSTORE_KEYCLOAK_REALM,
    PROMPTSTORE_KEYCLOAK_CLIENT_ID,
    PROMPTSTORE_KEYCLOAK_CLIENT_SECRET,
    KEYCLOAK_HOST,
  },
  logger,
});
promptStore.addFunction('sentiment', { model: 'sentiment' });
promptStore.addFunction('emojify', { model: 'emotion' });
promptStore.addFunction('extract_topics', { model: 'topic' });

const analysisService = AnalysisService({ logger, promptStore });
const contentService = ContentService({ pg, logger });

async function run() {
  const connectionOptions = {
    address: process.env.TEMPORAL_URL,
  };
  const connection = await NativeConnection.connect(connectionOptions);
  // Step 1: Register Workflows and Activities with the Worker and connect to
  // the Temporal server.
  const worker = await Worker.create({
    connection,
    workflowsPath: require.resolve('./workflows'),
    activities: createActivities(analysisService, contentService),
    taskQueue: 'analysis',
  });
  // Worker connects to localhost by default and uses console.error for logging.
  // Customize the Worker by passing more options to create():
  // https://typescript.temporal.io/api/classes/worker.Worker
  // If you need to configure server connection parameters, see docs:
  // https://docs.temporal.io/typescript/security#encryption-in-transit-with-mtls

  // Step 2: Start accepting tasks on the `hello-world` queue
  await worker.run();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});