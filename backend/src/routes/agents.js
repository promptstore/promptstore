export default ({ agents, app, auth, logger, services }) => {

  const { agentsService, tool } = services;

  let clients = [];
  let events = [];

  const sendEventToAllClients = (event) => {
    clients.forEach(client => client.response.write(`data: ${JSON.stringify(event)}\n\n`));
  };

  const addEvent = (event) => {
    events.push(event);
    sendEventToAllClients(event);
  };

  const eventsHandler = (req, res) => {
    const headers = {
      'Content-Type': 'text/event-stream',
      'Connection': 'keep-alive',
      'Cache-Control': 'no-cache',
    };
    res.writeHead(200, headers);
    res.write('data: ' + JSON.stringify(events.join('\n\n')) + '\n\n');
    const clientId = Date.now();
    const newClient = { id: clientId, response: res };
    clients.push(newClient);
    req.on('close', () => {
      logger.log('debug', '%s connection closed', clientId);
      clients = clients.filter(client => client.id !== clientId);
    });
  };

  app.get('/api/agent-events', eventsHandler);

  app.get('/api/agent-status', async (req, res) => {
    res.json({ clients: clients.length });
  });

  app.post('/api/agent-executions', auth, async (req, res, next) => {
    const { agentType, goal, indexName, name, selfEvaluate, tools } = req.body.agent;
    const workspaceId = req.body.workspaceId;
    // logger.log('debug', 'user:', req.user);
    const { email, username } = (req.user || {});
    events = [];
    let agent;
    if (agentType === 'plan') {
      agent = new agents.PlanAndExecuteAgent({ workspaceId, username });
    } else {
      agent = new agents.MKRLAgent({ isChat: true, workspaceId, username });
    }
    if (!agent) {
      return res.sendStatus(400);
    }
    agent.emitter.on('event', (data) => {
      // logger.log('debug', '>>', data);
      addEvent(data);
    });
    const callParams = {
      agentName: name,
      email,
      indexName,
    };
    await agent.run(goal, tools, callParams, selfEvaluate);
    res.json({ status: 'OK' });
  });

  app.get('/api/tools', (req, res, next) => {
    const tools = tool.getTools();
    res.json(tools);
  });

  app.get('/api/workspaces/:workspaceId/agents', auth, async (req, res, next) => {
    const { workspaceId } = req.params;
    const agents = await agentsService.getAgents(workspaceId);
    res.json(agents);
  });

  app.get('/api/agents/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    const session = await agentsService.getAgent(id);
    res.json(session);
  });

  app.post('/api/agents', auth, async (req, res, next) => {
    const { username } = req.user;
    const values = req.body;
    // const content = values.messages
    //   .filter((m) => m.role === 'user')
    //   .map((m) => m.content)
    //   .join('\n\n');
    // const args = { content };
    // const resp = await executionsService.executeFunction('create_summary_label', args, {});
    // const name = resp.choices[0].message.content;
    const agent = await agentsService.upsertAgent(values, username);
    res.json(agent);
  });

  app.put('/api/agents/:id', auth, async (req, res, next) => {
    const { id } = req.params;
    const { username } = req.user;
    const values = req.body;
    const agent = await agentsService.upsertAgent({ ...values, id }, username);
    res.json(agent);
  });

  app.delete('/api/agents/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    await agentsService.deleteAgents([id]);
    res.json(id);
  });

  app.delete('/api/agents', auth, async (req, res, next) => {
    const ids = req.query.ids.split(',');
    await agentsService.deleteAgents(ids);
    res.json(ids);
  });

}
