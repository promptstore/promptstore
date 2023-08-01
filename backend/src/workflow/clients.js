const { Connection, Client } = require('@temporalio/client');
const { reloads, uploads } = require('./workflows');

async function reload(file, workspaceId, uploadId, connectionOptions) {
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
    args: [file, workspaceId, uploadId],
    taskQueue: 'reloads',
    workflowId: 'workflow-' + Date.now(),
  });
  console.log(`Started workflow ${handle.workflowId}`);

  // optional: wait for client result
  // console.log(await handle.result());
}

async function upload(file, workspaceId, constants, connectionOptions) {
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

  const handle = await client.workflow.start(uploads, {
    // type inference works! args: [name: string]
    args: [file, workspaceId, constants],
    taskQueue: 'uploads',
    workflowId: 'workflow-' + Date.now(),
  });
  console.log(`Started workflow ${handle.workflowId}`);

  // optional: wait for client result
  // console.log(await handle.result());
  return handle.result();
}

module.exports = { reload, upload };