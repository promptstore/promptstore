import { default as dayjs } from 'dayjs';
import { Client, Connection, ScheduleOverlapPolicy } from '@temporalio/client';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';
import path from 'path';

import {
  evaluates,
  executeAgentNetworks,
  executeCompositions,
  executeTestScenarios,
  indexs,
  logCalls,
  reloads,
  transforms,
  uploads,
} from './workflows';

import logger from '../logger';

const ENV = process.env.ENV?.toLowerCase();
const TEMPORAL_URL = process.env.TEMPORAL_URL;
const TEMPORAL_NAMESPACE = process.env.TEMPORAL_NAMESPACE;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function getConnection() {
  const crt = await fs.readFile(`${__dirname}/ca.pem`);
  const key = await fs.readFile(`${__dirname}/ca.key`);
  let connectionOptions;
  if (ENV === 'dev' && false) {
    connectionOptions = {
      address: TEMPORAL_URL,
    };
  } else {
    connectionOptions = {
      // address: TEMPORAL_URL,
      address: `${TEMPORAL_NAMESPACE}.tmprl.cloud:7233`,
      tls: { clientCertPair: { crt, key } },
    };
  }
  const connection = await Connection.connect(connectionOptions);
  return connection;
}

export async function evaluate(evaluation, workspaceId, username) {
  // Connect to the default Server location (localhost:7233)
  const connection = await getConnection();
  // In production, pass options to configure TLS and other settings:
  // {
  //   address: 'foo.bar.tmprl.cloud',
  //   tls: {}
  // }

  const client = new Client({
    connection,
    // namespace: 'foo.bar', // connects to 'default' namespace if not specified
    namespace: process.env.TEMPORAL_NAMESPACE || 'promptstore',
  });

  const handle = await client.workflow.start(evaluates, {
    // type inference works! args: [name: string]
    args: [evaluation, workspaceId, username],
    taskQueue: 'worker',
    workflowId: 'evaluate-workflow-' + Date.now(),
  });
  console.log('Started workflow', handle.workflowId);

  // optional: wait for client result
  // console.log(await handle.result());
  return handle.result();
}

export async function scheduleEvaluation(evaluation, workspaceId, username, connectionOptions) {
  logger.debug('schedule evaluation:', evaluation);
  const connection = await getConnection();
  const client = new Client({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || 'promptstore',
  });
  const { schedule } = evaluation;
  const spec = getSpec(schedule);
  const scheduleOptions = {
    action: {
      type: 'startWorkflow',
      workflowType: evaluates,
      args: [evaluation, workspaceId, username],
      taskQueue: 'worker',
    },
    scheduleId: 'evaluate-schedule-' + evaluation.id,
    policies: {
      catchupWindow: '1 day',
      overlap: ScheduleOverlapPolicy.ALLOW_ALL,
    },
    spec,
  };
  logger.debug('schedule options:', scheduleOptions);

  let scheduleHandle;
  if (evaluation.scheduleId) {
    logger.debug('updating schedule:', evaluation.scheduleId);
    scheduleHandle = client.schedule.getHandle(evaluation.scheduleId);
    await scheduleHandle.update(schedule => {
      schedule.spec = spec;
      return schedule;
    });
  } else {
    logger.debug('creating schedule');
    scheduleHandle = await client.schedule.create(scheduleOptions);
    logger.debug('schedule id:', scheduleHandle.scheduleId);
  }

  return scheduleHandle.scheduleId;
}

export async function executeAgentNetwork(params, connectionOptions) {
  // Connect to the default Server location (localhost:7233)
  const connection = await getConnection();
  // In production, pass options to configure TLS and other settings:
  // {
  //   address: 'foo.bar.tmprl.cloud',
  //   tls: {}
  // }

  const client = new Client({
    connection,
    // namespace: 'foo.bar', // connects to 'default' namespace if not specified
    namespace: process.env.TEMPORAL_NAMESPACE || 'promptstore',
  });

  const handle = await client.workflow.start(executeAgentNetworks, {
    // type inference works! args: [name: string]
    args: [params],
    taskQueue: 'worker',
    workflowId: 'exec-agent-network-workflow-' + Date.now(),
  });
  console.log('Started workflow', handle.workflowId);

  // optional: wait for client result
  // console.log(await handle.result());
  return handle.result();
}

export async function executeComposition(params, connectionOptions) {
  // Connect to the default Server location (localhost:7233)
  const connection = await getConnection();
  // In production, pass options to configure TLS and other settings:
  // {
  //   address: 'foo.bar.tmprl.cloud',
  //   tls: {}
  // }

  const client = new Client({
    connection,
    // namespace: 'foo.bar', // connects to 'default' namespace if not specified
    namespace: process.env.TEMPORAL_NAMESPACE || 'promptstore',
  });

  const handle = await client.workflow.start(executeCompositions, {
    // type inference works! args: [name: string]
    args: [params],
    taskQueue: 'worker',
    workflowId: 'exec-composition-workflow-' + Date.now(),
  });
  console.log('Started workflow', handle.workflowId);

  // optional: wait for client result
  // console.log(await handle.result());
  return handle.result();
}

export async function executeTestScenario(testScenarioId, workspaceId, username, connectionOptions) {
  // Connect to the default Server location (localhost:7233)
  const connection = await getConnection();
  // In production, pass options to configure TLS and other settings:
  // {
  //   address: 'foo.bar.tmprl.cloud',
  //   tls: {}
  // }

  const client = new Client({
    connection,
    // namespace: 'foo.bar', // connects to 'default' namespace if not specified
    namespace: process.env.TEMPORAL_NAMESPACE || 'promptstore',
  });

  const handle = await client.workflow.start(executeTestScenarios, {
    // type inference works! args: [name: string]
    args: [testScenarioId, workspaceId, username],
    taskQueue: 'worker',
    workflowId: 'execute-test-scenario-workflow-' + Date.now(),
  });
  console.log('Started workflow', handle.workflowId);

  // optional: wait for client result
  // console.log(await handle.result());
  return handle.result();
}

export async function scheduleComposition(values, params, connectionOptions) {
  logger.debug('schedule composition:', params);
  const connection = await getConnection();
  const client = new Client({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || 'promptstore',
  });
  const { compositionId, scheduleId, schedule } = values;
  const spec = getSpec(schedule);
  const scheduleOptions = {
    action: {
      type: 'startWorkflow',
      workflowType: executeCompositions,
      args: [params],
      taskQueue: 'worker',
    },
    scheduleId: 'composition-schedule-' + compositionId,
    policies: {
      catchupWindow: '1 day',
      overlap: ScheduleOverlapPolicy.ALLOW_ALL,
    },
    spec,
  };
  logger.debug('schedule options:', scheduleOptions);

  let scheduleHandle;
  if (scheduleId) {
    logger.debug('updating schedule:', scheduleId);
    scheduleHandle = client.schedule.getHandle(scheduleId);
    await scheduleHandle.update(schedule => {
      schedule.spec = spec;
      return schedule;
    });
  } else {
    logger.debug('creating schedule');
    scheduleHandle = await client.schedule.create(scheduleOptions);
    logger.debug('schedule id:', scheduleHandle.scheduleId);
  }

  return scheduleHandle.scheduleId;
}

export async function index(params, loaderProvider, extractorProviders, connectionOptions) {
  // Connect to the default Server location (localhost:7233)
  const connection = await getConnection();
  // In production, pass options to configure TLS and other settings:
  // {
  //   address: 'foo.bar.tmprl.cloud',
  //   tls: {}
  // }

  const client = new Client({
    connection,
    // namespace: 'foo.bar', // connects to 'default' namespace if not specified
    namespace: process.env.TEMPORAL_NAMESPACE || 'promptstore',
  });

  const handle = await client.workflow.start(indexs, {
    // type inference works! args: [name: string]
    args: [params, loaderProvider, extractorProviders],
    taskQueue: 'worker',
    workflowId: 'index-workflow-' + Date.now(),
  });
  console.log('Started workflow', handle.workflowId);

  // optional: wait for client result
  // console.log(await handle.result());
  return handle.result();
}

export async function logCall(params, connectionOptions) {
  // Connect to the default Server location (localhost:7233)
  const connection = await getConnection();
  // In production, pass options to configure TLS and other settings:
  // {
  //   address: 'foo.bar.tmprl.cloud',
  //   tls: {}
  // }

  const client = new Client({
    connection,
    // namespace: 'foo.bar', // connects to 'default' namespace if not specified
    namespace: process.env.TEMPORAL_NAMESPACE || 'promptstore',
  });

  const handle = await client.workflow.start(logCalls, {
    // type inference works! args: [name: string]
    args: [params],
    taskQueue: 'worker',
    workflowId: 'log-call-workflow-' + Date.now(),
  });
  console.log('Started workflow', handle.workflowId);

  // optional: wait for client result
  // console.log(await handle.result());
  return handle.result();
}

const DAYS_OF_WEEK = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

export async function transform(transformation, workspaceId, username, connectionOptions) {
  // Connect to the default Server location (localhost:7233)
  const connection = await getConnection();
  // In production, pass options to configure TLS and other settings:
  // {
  //   address: 'foo.bar.tmprl.cloud',
  //   tls: {}
  // }

  const client = new Client({
    connection,
    // namespace: 'foo.bar', // connects to 'default' namespace if not specified
    namespace: process.env.TEMPORAL_NAMESPACE || 'promptstore',
  });

  const handle = await client.workflow.start(transforms, {
    // type inference works! args: [name: string]
    args: [transformation, workspaceId, username],
    // taskQueue: 'transforms',
    taskQueue: 'worker',
    workflowId: 'transform-workflow-' + Date.now(),
  });
  console.log('Started workflow', handle.workflowId);

  // optional: wait for client result
  // console.log(await handle.result());
  return handle.result();
}

export async function scheduleTransformation(transformation, workspaceId, username, connectionOptions) {
  logger.debug('schedule transformation:', transformation);
  const connection = await getConnection();
  const client = new Client({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || 'promptstore',
  });
  const { schedule } = transformation;
  const spec = getSpec(schedule);
  const scheduleOptions = {
    action: {
      type: 'startWorkflow',
      workflowType: transforms,
      args: [transformation, workspaceId, username],
      taskQueue: 'worker',
    },
    scheduleId: 'transform-schedule-' + transformation.id,
    policies: {
      catchupWindow: '1 day',
      overlap: ScheduleOverlapPolicy.ALLOW_ALL,
    },
    spec,
  };
  logger.debug('schedule options:', scheduleOptions);

  let scheduleHandle;
  if (transformation.scheduleId) {
    logger.debug('updating schedule:', transformation.scheduleId);
    scheduleHandle = client.schedule.getHandle(transformation.scheduleId);
    await scheduleHandle.update(schedule => {
      schedule.spec = spec;
      return schedule;
    });
  } else {
    logger.debug('creating schedule');
    scheduleHandle = await client.schedule.create(scheduleOptions);
    logger.debug('schedule id:', scheduleHandle.scheduleId);
  }

  return scheduleHandle.scheduleId;
}

export async function upload(file, workspaceId, appId, username, constants, connectionOptions) {
  // Connect to the default Server location (localhost:7233)
  const connection = await getConnection();
  // In production, pass options to configure TLS and other settings:
  // {
  //   address: 'foo.bar.tmprl.cloud',
  //   tls: {}
  // }

  const client = new Client({
    connection,
    // namespace: 'foo.bar', // connects to 'default' namespace if not specified
    namespace: process.env.TEMPORAL_NAMESPACE || 'promptstore',
  });

  // console.log('args:', file, workspaceId, username, constants);

  const handle = await client.workflow.start(uploads, {
    // type inference works! args: [name: string]
    args: [file, workspaceId, appId, username, constants],
    // taskQueue: 'uploads',
    taskQueue: 'worker',
    workflowId: 'upload-workflow-' + Date.now(),
  });
  console.log('Started workflow', handle.workflowId);

  // optional: wait for client result
  // console.log(await handle.result());
  return handle.result();
}

export async function reload(file, workspaceId, username, uploadId, connectionOptions) {
  // Connect to the default Server location (localhost:7233)
  const connection = await getConnection();
  // In production, pass options to configure TLS and other settings:
  // {
  //   address: 'foo.bar.tmprl.cloud',
  //   tls: {}
  // }

  const client = new Client({
    connection,
    // namespace: 'foo.bar', // connects to 'default' namespace if not specified
    namespace: process.env.TEMPORAL_NAMESPACE || 'promptstore',
  });

  const handle = await client.workflow.start(reloads, {
    // type inference works! args: [name: string]
    args: [file, workspaceId, username, uploadId],
    // taskQueue: 'reloads',
    taskQueue: 'worker',
    workflowId: 'reload-workflow-' + Date.now(),
  });
  console.log('Started workflow', handle.workflowId);

  // optional: wait for client result
  // console.log(await handle.result());
  return handle.result();
}

function getSpec(schedule) {
  const spec = {};
  if (schedule.frequency && schedule.frequency !== 'norepeat') {
    spec.intervals = [
      {
        every: (schedule.frequencyLength || '1') + schedule.frequency + 's',
      },
    ];
    if (schedule.endDate) {
      const endDate = dayjs(schedule.endDate);
      spec.endAt = endDate.toDate();
    }
    if (schedule.startDate) {
      if (schedule.frequency === 'week') {
        let hour = 0;
        let minute = 0;
        if (schedule.startTime) {
          const time = dayjs(schedule.startDate + ' ' + schedule.startTime);
          hour = time.hour();
          minute = time.minute();
        }
        spec.calendars = [
          {
            dayOfWeek: DAYS_OF_WEEK[schedule.frequencyDayOfWeek || 0],
            hour,
            minute,
          },
        ];
      }
      const startDate = dayjs(schedule.startDate);
      spec.startAt = startDate.toDate();
      if (
        schedule.ends === 'after' &&
        schedule.afterLength &&
        schedule.frequency &&
        schedule.frequency !== 'norepeat'
      ) {
        const endDate = startDate.add(+schedule.afterLength, schedule.frequency);
        spec.endAt = endDate.toDate();
      }
    }
  }
  return spec;
}

export async function pauseSchedule(scheduleId, connectionOptions) {
  logger.debug('pausing schedule:', scheduleId);
  const connection = await getConnection();
  const client = new Client({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || 'promptstore',
  });
  const scheduleHandle = client.schedule.getHandle(scheduleId);
  await scheduleHandle.pause();
}

export async function unpauseSchedule(scheduleId, connectionOptions) {
  logger.debug('pausing schedule:', scheduleId);
  const connection = await getConnection();
  const client = new Client({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || 'promptstore',
  });
  const scheduleHandle = client.schedule.getHandle(scheduleId);
  await scheduleHandle.unpause();
}

export async function deleteSchedule(scheduleId, connectionOptions) {
  logger.debug('pausing schedule:', scheduleId);
  const connection = await getConnection();
  const client = new Client({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || 'promptstore',
  });
  const scheduleHandle = client.schedule.getHandle(scheduleId);
  await scheduleHandle.delete();
}
