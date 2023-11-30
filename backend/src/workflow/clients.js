import { Client, Connection } from '@temporalio/client';
import { indexs, reloads, transforms, uploads } from './workflows';

export async function reload(file, workspaceId, username, uploadId, connectionOptions) {
  // Connect to the default Server location (localhost:7233)
  const connection = await Connection.connect(connectionOptions);
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
    workflowId: 'workflow-' + Date.now(),
  });
  console.log('Started workflow', handle.workflowId);

  // optional: wait for client result
  // console.log(await handle.result());
  return handle.result();
}

export async function upload(file, workspaceId, appId, username, constants, connectionOptions) {
  // Connect to the default Server location (localhost:7233)
  const connection = await Connection.connect(connectionOptions);
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
    workflowId: 'workflow-' + Date.now(),
  });
  console.log('Started workflow', handle.workflowId);

  // optional: wait for client result
  // console.log(await handle.result());
  return handle.result();
}

export async function transform(transformation, workspaceId, username, connectionOptions) {
  // Connect to the default Server location (localhost:7233)
  const connection = await Connection.connect(connectionOptions);
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
    workflowId: 'workflow-' + Date.now(),
  });
  console.log('Started workflow', handle.workflowId);

  // optional: wait for client result
  // console.log(await handle.result());
  return handle.result();
}

export async function index(params, loaderProvider, extractorProviders, connectionOptions) {
  // Connect to the default Server location (localhost:7233)
  const connection = await Connection.connect(connectionOptions);
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
    workflowId: 'workflow-' + Date.now(),
  });
  console.log('Started workflow', handle.workflowId);

  // optional: wait for client result
  // console.log(await handle.result());
  return handle.result();
}
