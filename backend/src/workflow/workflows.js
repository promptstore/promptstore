import { proxyActivities } from '@temporalio/workflow';

const { evaluate, index, logCall, reload, transform, upload } = proxyActivities({
  scheduleToCloseTimeout: '20m',
  startToCloseTimeout: '10m',
  retry: {
    maximumAttempts: 2,
  }
});

export async function evaluates(evaluation, workspaceId, username) {
  return await evaluate(evaluation, workspaceId, username);
}

export async function indexs(params, loaderProvider, extractorProviders) {
  return await index(params, loaderProvider, extractorProviders);
}

export async function logCalls(params) {
  return await logCall(params);
}

export async function transforms(transformation, workspaceId, username) {
  return await transform(transformation, workspaceId, username);
}

export async function uploads(file, workspaceId, appId, username, constants) {
  return await upload(file, workspaceId, appId, username, constants);
}

export async function reloads(file, workspaceId, username, uploadId) {
  return await reload(file, workspaceId, username, uploadId);
}
