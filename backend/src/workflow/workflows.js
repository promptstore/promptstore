import { proxyActivities } from '@temporalio/workflow';

const {
  evaluate,
  executeAgentNetwork,
  executeComposition,
  executeTestScenario,
  index,
  logCall,
  reload,
  transform,
  upload,
} = proxyActivities({
  scheduleToCloseTimeout: '20m',
  startToCloseTimeout: '10m',
  retry: {
    maximumAttempts: 1,
  },
});

export function evaluates(evaluation, workspaceId, username) {
  return evaluate(evaluation, workspaceId, username);
}

export function executeAgentNetworks(params) {
  return executeAgentNetwork(params);
}

export function executeCompositions(params) {
  return executeComposition(params);
}

export function executeTestScenarios(params) {
  return executeTestScenario(params);
}

export function indexs(params, loaderProvider, extractorProviders) {
  return index(params, loaderProvider, extractorProviders);
}

export function logCalls(params) {
  return logCall(params);
}

export function transforms(transformation, workspaceId, username) {
  return transform(transformation, workspaceId, username);
}

export function uploads(file, workspaceId, appId, username, constants) {
  return upload(file, workspaceId, appId, username, constants);
}

export function reloads(file, workspaceId, username, uploadId) {
  return reload(file, workspaceId, username, uploadId);
}
