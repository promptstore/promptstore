const { proxyActivities } = require('@temporalio/workflow');

const { analyze } = proxyActivities({
  scheduleToCloseTimeout: '20m',
  startToCloseTimeout: '10m',
  retry: {
    maximumAttempts: 2,
  }
});

async function analysis(contentId) {
  return await analyze(contentId);
}

module.exports = { analysis };