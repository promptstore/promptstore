import EventEmitter from 'events';

import { AgentDebugCallback } from '../agents/AgentDebugCallback';
import { AgentEventEmitterCallback } from '../agents/AgentEventEmitterCallback';
import { AgentTracingCallback } from '../agents/AgentTracingCallback';

export default ({ agents, app, auth, logger, services }) => {

  const { agentsService, tool, tracesService } = services;

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
    for (const event of events) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
    const clientId = Date.now();
    const newClient = { id: clientId, response: res };
    clients.push(newClient);
    req.on('close', () => {
      logger.log('debug', '%s connection closed', clientId);
      clients = clients.filter(client => client.id !== clientId);
      events = [];
    });
  };

  /**
   * @openapi
   * components:
   *   schemas:
   *     AgentParams:
   *       type: object
   *       required:
   *         - agentType
   *         - goal
   *         - name
   *         - tools
   *       properties:
   *         agentType:
   *           type: string
   *           description: The type of agent to run, e.g. "plan", "react"
   *         goal:
   *           type: string
   *           description: The user request, query, or instruction.
   *         name:
   *           type: string
   *           description: The agent name. Used for tracing.
   *         tools:
   *           type: array
   *           description: The allowed tools as a list of keys.
   *           items:
   *             type: string
   *         indexName:
   *           type: string
   *           description: A parameter required by a tool - the name of a semantic index to query.
   *         selfEvaluate:
   *           type: boolean
   *           description: A flag to tell the agent to evaluate its own output using a model.
   *       
   *     AgentExecutionRequest:
   *       type: object
   *       required:
   *         - agent
   *         - workspaceId
   *       properties:
   *         agent:
   *           type: AgentParams
   *           description: Agent parameters
   *         workspaceId:
   *           type: integer
   *           description: The workspace identifier
   * 
   *     Tool:
   *       type: object
   *       required:
   *         - key
   *         - name
   *         - description
   *       properties:
   *         key:
   *           type: string
   *           description: The tool identifier.
   *         name:
   *           type: string
   *           description: The tool name.
   *         description:
   *           type: string
   *           description: A description of the tool purpose and function. This is used by the LLM to determine when it is applicable for the tool to be called.
   */

  /**
   * @openapi
   * tags:
   *   name: Agents
   *   description: The Agent Management API
   */

  /**
   * @openapi
   * /api/agent-events:
   *   get:
   *     description: Get agent output as server-side events (SSE).
   *     tags: [Agents]
   *     produces:
   *       - text/event-stream
   *     responses:
   *       200:
   *         description: An event stream of agent output.
   *       500:
   *         description: Error
   */
  app.get('/api/agent-events', eventsHandler);

  /**
   * @openapi
   * /api/agent-status:
   *   get:
   *     description: Get the number of clients currently connected
   *     tags: [Agents]
   *     produces:
   *       - application/json
   *     responses:
   *       200:
   *         description: Number of clients
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               required:
   *                 - clients
   *               properties:
   *                 clients:
   *                   type: integer
   *                   description: The number of clients
   */
  app.get('/api/agent-status', async (req, res) => {
    res.json({ clients: clients.length });
  });

  /**
   * @openapi
   * /api/agent-executions:
   *   post:
   *     description: Execute an agent run
   *     tags: [Agents]
   *     produces:
   *       - application/json
   *     requestBody:
   *       description: The execution parameters.
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/AgentExecutionRequest'
   *     responses:
   *       200:
   *         description: A successful run.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Status'
   *       500:
   *         description: Error
   */
  app.post('/api/agent-executions', auth, async (req, res) => {
    let {
      agentType,
      allowedTools,
      goal,
      indexName,
      isChat,
      model,
      name,
      provider,
      selfEvaluate,
      useFunctions,
    } = req.body.agent;
    const workspaceId = req.body.workspaceId;
    const { email, username } = (req.user || {});
    model = model || 'gpt-3.5-turbo';
    const modelParams = { max_tokens: 255 };
    const emitter = new EventEmitter();
    const callbacks = [
      new AgentTracingCallback({ workspaceId, username, tracesService }),
      new AgentDebugCallback({ workspaceId, username }),
      new AgentEventEmitterCallback({ workspaceId, username, emitter }),
    ];
    const options = {
      name,
      isChat,
      model,
      modelParams,
      provider,
      workspaceId,
      username,
      callbacks,
      useFunctions,
    };
    let agent;
    if (agentType === 'plan') {
      agent = new agents.PlanAndExecuteAgent(options);
    } else {
      agent = new agents.MKRLAgent(options);
    }
    if (!agent) {
      return res.sendStatus(400);
    }
    const extraFunctionCallParams = {
      email,
      indexName,
    };
    let done = false;
    events = [];
    emitter.on('event', (data) => {
      addEvent(data);
    });
    emitter.on('done', (data) => {
      addEvent(data);
      done = true;
    });
    await agent.run({ goal, allowedTools, extraFunctionCallParams, selfEvaluate });

    // TODO the following may not be necessary if it is the client that
    // is closing the connection early.
    // UPDATE it was the client
    /*
    const waitUntilDone = (retryCount = 0) => new Promise((resolve) => {
      if (done || retryCount > 10) {
        return resolve();
      }
      setTimeout(waitUntilDone, 1000, retryCount + 1);
    });

    await waitUntilDone();
    ** *******************/

    res.json({ status: 'OK' });
  });

  /**
   * @openapi
   * /api/tools:
   *   get:
   *     description: Get the list of available tools.
   *     tags: [Agents]
   *     produces:
   *       - application/json
   *     responses:
   *       200:
   *         description: The list of tools.
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Tool'
   *       500:
   *         description: Error
   */
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
