import EventEmitter from 'events';

import { AgentDebugCallback } from '../agents/AgentDebugCallback';
import { AgentEventEmitterCallback } from '../agents/AgentEventEmitterCallback';
import { AgentTracingCallback } from '../agents/AgentTracingCallback';
import searchFunctions from '../searchFunctions';

export default ({ agents, app, auth, constants, logger, services }) => {

  const OBJECT_TYPE = 'agents';

  const { agentsService, functionsService, toolService, tracesService } = services;

  const { deleteObjects, deleteObject, indexObject } = searchFunctions({ constants, logger, services });

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
   *         allowedTools:
   *           type: array
   *           description: The allowed tools as a list of keys.
   *           items:
   *             type: string
   *         goal:
   *           type: string
   *           description: The user request, query, or instruction.
   *         indexName:
   *           type: string
   *           description: A parameter required by the search index tool - the name of the semantic index to query.
   *         isChat:
   *           type: boolean
   *           description: A flag to indicate if the agent will use a chat api.
   *         model:
   *           type: string
   *           description: The model key used by the agent.
   *         name:
   *           type: string
   *           description: The agent name. Used for tracing.
   *         provider:
   *           type:
   *           description: The model provider.
   *         selfEvaluate:
   *           type: boolean
   *           description: A flag to tell the agent to evaluate its own output using a model.
   *         useFunctions:
   *           type: boolean
   *           description: A flag to indicate if the agent will use model supported function calling if available.
   *       
   *     AgentExecutionRequest:
   *       type: object
   *       required:
   *         - agent
   *         - workspaceId
   *       properties:
   *         agent:
   *           $ref: '#/components/schemas/AgentParams'
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
   * 
   *     Agent:
   *       type: object
   *       required:
   *         - name
   *       properties:
   *         name:
   *           type: string
   *           description: The agent name.
   *         goal:
   *           type: string
   *           description: The user request, query, or instruction.
   *         agentType:
   *           type: string
   *           description: The type of agent to run, e.g. "plan", "react"
   *         allowedTools:
   *           type: array
   *           description: The allowed tools as a list of keys.
   *           items:
   *             type: string
   *         indexName:
   *           type: string
   *           description: A parameter required by the search index tool - the name of the semantic index to query.
   *         modelId:
   *           type: integer
   *           description: The model id.
   *         useFunctions:
   *           type: boolean
   *           description: A flag to indicate if the agent will use model supported function calling if available.
   *         selfEvaluate:
   *           type: boolean
   *           description: A flag to tell the agent to evaluate its own output using a model.
   *         created:
   *           type: string
   *           format: date-time
   *           description: The date-time the agent was created.
   *         createdBy:
   *           type: string
   *           description: The username of the user who created the workspace.
   *         modified:
   *           type: string
   *           format: date-time
   *           description: The date-time the agent was last modified.
   *         modifiedBy:
   *           type: string
   *           description: The username of the user who last modified the workspace.
   * 
   *     AgentInput:
   *       type: object
   *       required:
   *         - name
   *       properties:
   *         name:
   *           type: string
   *           description: The agent name.
   *         goal:
   *           type: string
   *           description: The user request, query, or instruction.
   *         agentType:
   *           type: string
   *           description: The type of agent to run, e.g. "plan", "react"
   *         allowedTools:
   *           type: array
   *           description: The allowed tools as a list of keys.
   *           items:
   *             type: string
   *         indexName:
   *           type: string
   *           description: A parameter required by the search index tool - the name of the semantic index to query.
   *         modelId:
   *           type: integer
   *           description: The model id.
   *         useFunctions:
   *           type: boolean
   *           description: A flag to indicate if the agent will use model supported function calling if available.
   *         selfEvaluate:
   *           type: boolean
   *           description: A flag to tell the agent to evaluate its own output using a model.
   *         createdBy:
   *           type: string
   *           description: The username of the user who created the workspace.
   *         modifiedBy:
   *           type: string
   *           description: The username of the user who last modified the workspace.
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

    // TODO
    events = [];

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
      functionId,
    } = req.body.agent;
    const workspaceId = req.body.workspaceId;
    const { email, username } = (req.user || {});
    model = model || 'gpt-3.5-turbo-0613';
    const modelParams = { max_tokens: 1024 };
    const emitter = new EventEmitter();
    const callbacks = [
      new AgentTracingCallback({ workspaceId, username, tracesService }),
      new AgentDebugCallback({ workspaceId, username }),
      new AgentEventEmitterCallback({ workspaceId, username, emitter }),
    ];
    let semanticFunction;
    if (allowedTools?.includes('semanticFunction') && functionId) {
      semanticFunction = await functionsService.getFunction(functionId);
    }
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
      semanticFunction,
    };
    let agent;
    if (agentType === 'plan') {
      agent = new agents.PlanAndExecuteAgent(options);
    } else if (agentType === 'openai') {
      agent = new agents.OpenAIAssistantAgent(options);
    } else if (agentType === 'react') {
      agent = new agents.MKRLAgent(options);
    } else {
      const errors = [
        {
          message: 'Unsupported agent type: ' + agentType,
        },
      ];
      return res.status(400).json({ errors });
    }
    const extraFunctionCallParams = {
      email: process.env.EMAIL_OVERRIDE || email,
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
    const tools = toolService.getTools();
    res.json(tools);
  });

  /**
   * @openapi
   * /api/workspaces/{workspaceId}/agents:
   *   get:
   *     description: List all the agents available to the given user in the given workspace.
   *     tags: [Agents]
   *     produces:
   *       - application/json
   *     parameters:
   *       - name: limit
   *         description: the maximum number of records to retrieve in the paged result
   *         in: query
   *         schema:
   *           type: integer
   *       - name: start
   *         description: The record offset to start the paged result
   *         in: query
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: The list of agents
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Agent'
   *       500:
   *         description: Error
   */
  app.get('/api/workspaces/:workspaceId/agents', auth, async (req, res, next) => {
    const { workspaceId } = req.params;
    const agents = await agentsService.getAgents(workspaceId);
    res.json(agents);
  });

  /**
   * @openapi
   * /api/agents/{id}:
   *   get:
   *     description: Lookup an agent by id.
   *     tags: [Workspaces]
   *     produces:
   *       application/json
   *     parameters:
   *       - name: id
   *         description: The agent id
   *         in: path
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: The agent
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Agent'
   *       500:
   *         description: Error
   */
  app.get('/api/agents/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    const session = await agentsService.getAgent(id);
    res.json(session);
  });

  /**
   * @openapi
   * /api/agents:
   *   post:
   *     description: Create a new agent.
   *     tags: [Agents]
   *     requestBody:
   *       description: The new agent values
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/AgentInput'
   *     responses:
   *       200:
   *         description: The new agent
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Agent'
   *       500:
   *         description: Error
   */
  app.post('/api/agents', auth, async (req, res, next) => {
    const { username } = req.user;
    const values = req.body;
    const agent = await agentsService.upsertAgent(values, username);
    const obj = createSearchableObject(agent);
    await indexObject(obj);
    res.json(agent);
  });

  /**
   * @openapi
   * /api/agents/{id}:
   *   put:
   *     description: Update an agent.
   *     tags: [Agents]
   *     parameters:
   *       - name: id
   *         description: The agent id
   *         in: path
   *         schema:
   *           type: integer
   *     requestBody:
   *       description: The updated agent values
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/AgentInput'
   *     responses:
   *       200:
   *         description: The updated agent
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Agent'
   *       500:
   *         description: Error
   */
  app.put('/api/agents/:id', auth, async (req, res, next) => {
    const { id } = req.params;
    const { username } = req.user;
    const values = req.body;
    const agent = await agentsService.upsertAgent({ ...values, id }, username);
    const obj = createSearchableObject(agent);
    await indexObject(obj);
    res.json(agent);
  });

  /**
   * @openapi
   * /api/agents/{id}:
   *   delete:
   *     description: Delete an agent.
   *     tags: [Agents]
   *     parameters:
   *       - name: id
   *         description: The agent id
   *         in: path
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: The deleted id
   *         content:
   *           text/plain:
   *             schema:
   *               type: integer
   *       500:
   *         description: Error
   */
  app.delete('/api/agents/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    await agentsService.deleteAgents([id]);
    await deleteObject(objectId(id));
    res.json(id);
  });

  /**
   * @openapi
   * /api/agents:
   *   delete:
   *     description: Delete multiple agents
   *     tags: [Agents]
   *     parameters:
   *       - name: ids
   *         description: A comma separated list of ids
   *         in: query
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: The deleted agent ids
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: string
   *       500:
   *         description: Error
   */
  app.delete('/api/agents', auth, async (req, res, next) => {
    const ids = req.query.ids.split(',');
    await agentsService.deleteAgents(ids);
    await deleteObjects(ids.map(objectId));
    res.json(ids);
  });

  const objectId = (id) => OBJECT_TYPE + ':' + id;

  function createSearchableObject(rec) {
    const texts = [
      rec.name,
      rec.goal,
    ];
    const text = texts.filter(t => t).join('\n');
    return {
      id: objectId(rec.id),
      nodeLabel: 'Object',
      label: 'Agents',
      type: OBJECT_TYPE,
      name: rec.name,
      text,
      createdDateTime: rec.created,
      createdBy: rec.createdBy,
      workspaceId: String(rec.workspaceId),
      metadata: {
        agentType: rec.agentType,
      },
    };
  }

}
