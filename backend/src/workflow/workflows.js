import { proxyActivities } from '@temporalio/workflow';

const { index, reload, transform, upload } = proxyActivities({
  scheduleToCloseTimeout: '20m',
  startToCloseTimeout: '10m',
  retry: {
    maximumAttempts: 2,
  }
});

export async function reloads(file, workspaceId, username, uploadId) {
  return await reload(file, workspaceId, username, uploadId);
}

export async function uploads(file, workspaceId, username, constants) {
  return await upload(file, workspaceId, username, constants);
}

export async function transforms(transformation, workspaceId, username) {
  return await transform(transformation, workspaceId, username);
}

export async function indexs(params, loaderProvider, extractorProviders) {
  return await index(params, loaderProvider, extractorProviders);
}
