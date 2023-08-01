const { proxyActivities } = require('@temporalio/workflow');

const { reload, upload } = proxyActivities({
  scheduleToCloseTimeout: '20m',
  startToCloseTimeout: '10m',
  retry: {
    maximumAttempts: 2,
  }
});

async function reloads(file, workspaceId, uploadId) {
  return await reload(file, workspaceId, uploadId);
}

async function uploads(file, workspaceId, constants) {
  return await upload(file, workspaceId, constants);
}

module.exports = { reloads, uploads };