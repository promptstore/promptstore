const { Connection, Client } = require('@temporalio/client');
const { analysis } = require('./workflows');

async function run(contentId, connectionOptions) {
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
  });

  const handle = await client.workflow.start(analysis, {
    // type inference works! args: [name: string]
    args: [contentId],
    taskQueue: 'analysis',
    workflowId: 'workflow-' + contentId,
  });
  console.log(`Started workflow ${handle.workflowId}`);

  // optional: wait for client result
  console.log(await handle.result());
}

// run().catch((err) => {
//   console.error(err);
//   process.exit(1);
// });

module.exports = { run };