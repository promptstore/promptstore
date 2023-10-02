import { PARA_DELIM } from '../core/conversions/RosettaStone';

export default ({ app, auth, logger, services }) => {

  const { chatSessionsService, executionsService } = services;

  /**
   * @openapi
   * components:
   *   schemas:
   *     ModelUsage:
   *       type: object
   *       properties:
   *         prompt_tokens:
   *           type: integer
   *           description: The number of tokens used in the prompt.
   *         completion_tokens:
   *           type: integer
   *           description: The number of tokens used in the response.
   *         total_tokens:
   *           type: integer
   *           description: The total number of tokens used.
   *       example:
   *         prompt_tokens: 77
   *         completion_tokens: 5
   *         total_tokens: 82
   * 
   *     ChatMessage:
   *       type: object
   *       required:
   *         - key
   *         - role
   *         - content
   *       properties:
   *         key:
   *           type: string
   *           description: The message key
   *         role:
   *           type: string
   *           description: The role of the messages author.
   *         content:
   *           type: string
   *           description: The contents of the message.
   *         model:
   *           type: string
   *           description: The type of model.
   *         usage:
   *           type: ModelUsage
   *           description: The number of prompts used in the model call.
   *       example:
   *         key: b1e7e13e-0980-4195-95b9-965e9b945e03
   *         role: user
   *         content: A long time ago in a galaxy far, far away
   *         model: gpt-3.5-turbo-0301
   *         usage:
   *           prompt_tokens: 77
   *           completion_tokens: 5
   *           total_tokens: 82
   * 
   *     ChatSession:
   *       type: object
   *       required:
   *         - id
   *         - workspaceId
   *         - name
   *       properties:
   *         id:
   *           type: integer
   *           description: The auto-generated id of the session
   *         workspaceId:
   *           type: integer
   *           description: The workspace id
   *         name:
   *           type: string
   *           description: The session name.
   *         description:
   *           type: string
   *           description: A description of the chat session
   *         messages:
   *           type: array
   *           items:
   *             type: ChatMessage
   *           description: The chat message history
   *         created:
   *           type: string
   *           format: date
   *           description: The date-time the chat was created
   *         createdBy:
   *           type: string
   *           description: The username of the user who created the chat.
   *         modified:
   *           type: string
   *           format: date
   *           description: The date-time the chat was last modified
   *         modifiedBy:
   *           type: string
   *           description: The username of the user who last modified the chat.
   *       example:
   *         id: 1
   *         workspaceId: 1
   *         name: Science fiction setting
   *         messages:
   *           - key: b1e7e13e-0980-4195-95b9-965e9b945e03
   *             role: user
   *             content: A long time ago in a galaxy far, far away
   *             model: gpt-3.5-turbo-0301
   *             usage:
   *               prompt_tokens: 77
   *               completion_tokens: 5
   *               total_tokens: 82
   *             created: 2023-03-01T10:30
   *             createdBy: markmo@acme.com
   *             modified: 2023-03-01T10:30
   *             modifiedBy: markmo@acme.com
   *           - key: e9288e9a-4dc9-43b4-9901-27217df1747a
   *             role: assistant
   *             content: there was a great disturbance in the Force.
   *             model: gpt-3.5-turbo-0301
   *             usage:
   *               prompt_tokens: 19
   *               completion_tokens: 10
   *               total_tokens: 29
   *             created: 2023-03-01T10:30
   *             createdBy: markmo@acme.com
   *             modified: 2023-03-01T10:30
   *             modifiedBy: markmo@acme.com
   * 
   *     ChatSessionInput:
   *       type: object
   *       properties:
   *         name:
   *           type: string
   *           description: The app name.
   *         description:
   *           type: string
   *           description: A description of the app
   *         promptSets:
   *           type: array
   *           items:
   *             type: integer
   *           description: The list of prompt templates in the app
   *         functions:
   *           type: array
   *           items:
   *             type: integer
   *           description: The list of semantic functions in the app
   *         dataSources:
   *           type: array
   *           items:
   *             type: integer
   *           description: The list of data sources in the app
   *         indexes:
   *           type: array
   *           items:
   *             type: integer
   *           description: The list of semantic indexes in the app
   *         createdBy:
   *           type: string
   *           description: The username of the user who created the workspace.
   *         modifiedBy:
   *           type: string
   *           description: The username of the user who last modified the workspace.
   *       example:
   *         id: 1
   *         name: Science fiction writing
   *         createdBy: markmo@acme.com
   *         modified: 2023-03-01T10:30
   */

  /**
   * @openapi
   * tags:
   *   name: ChatSessions
   *   description: The Chat Session Management API
   */

  /**
   * @openapi
   * /api/workspaces/:workspaceId/chat-sessions:
   *   get:
   *     description: List all the chat sessions in the given workspace.
   *     tags: [ChatSessions]
   *     produces:
   *       - application/json
   *     parameters:
   *       - name: workspaceId
   *         description: The workspace id.
   *         in: path
   *         schema:
   *           type: integer
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
   *         description: The list of chat sessions
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/ChatSession'
   *       500:
   *         description: Error
   */
  app.get('/api/workspaces/:workspaceId/chat-sessions', auth, async (req, res, next) => {
    const { workspaceId } = req.params;
    const { type } = req.query;
    const { username } = req.user;
    const sessions = await chatSessionsService.getChatSessions(workspaceId, type, username);
    res.json(sessions);
  });

  /**
   * @openapi
   * /api/chat-sessions/:id:
   *   get:
   *     description: Lookup a session by id.
   *     tags: [ChatSessions]
   *     produces:
   *       application/json
   *     parameters:
   *       - name: id
   *         description: The session id
   *         in: path
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: The chat session
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ChatSession'
   *       500:
   *         description: Error
   */
  app.get('/api/chat-sessions/:id', auth, async (req, res, next) => {
    const { id } = req.params;
    const session = await chatSessionsService.getChatSession(id);
    res.json(session);
  });

  /**
   * @openapi
   * /api/chat-sessions:
   *   post:
   *     description: Create a new session.
   *     tags: [ChatSessions]
   *     requestBody:
   *       description: The new session values
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/ChatSessionInput'
   *     responses:
   *       200:
   *         description: The new session
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ChatSession'
   *       500:
   *         description: Error
   */
  app.post('/api/chat-sessions', auth, async (req, res, next) => {
    const { username } = req.user;
    const values = req.body;
    const content = values.messages
      .map((m) => {
        if (Array.isArray(m.content)) {
          return m.content.map(c => c.content).join(PARA_DELIM);
        }
        return m.content;
      })
      .join(PARA_DELIM)
      ;
    const args = { content };
    let sessionInput;
    try {
      const { response, errors } = await executionsService.executeFunction({
        workspaceId: values.workspaceId,
        username,
        semanticFunctionName: 'create_summary_label',
        args,
        params: {},
      });
      if (errors) {
        res.status(500).send({ errors });
      }
      const name = response.choices[0].message.content;
      logger.debug('name:', name);
      sessionInput = { ...values, name };
    } catch (err) {
      logger.warn(err, err.stack);
      // skip name
      sessionInput = values;
    }
    const session = await chatSessionsService.upsertChatSession(sessionInput, username);
    res.json(session);
  });

  /**
   * @openapi
   * /api/chat-sessions/:id:
   *   put:
   *     description: Update a session.
   *     tags: [ChatSessions]
   *     parameters:
   *       - name: id
   *         description: The session id
   *         in: path
   *         schema:
   *           type: integer
   *     requestBody:
   *       description: The updated session values
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/ChatSessionInput'
   *     responses:
   *       200:
   *         description: The updated session
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ChatSession'
   *       500:
   *         description: Error
   */
  app.put('/api/chat-sessions/:id', auth, async (req, res, next) => {
    const { id } = req.params;
    const { username } = req.user;
    const values = req.body;
    const content = values.messages
      .map((m) => {
        if (Array.isArray(m.content)) {
          return m.content.map(c => c.content).join(PARA_DELIM);
        }
        return m.content;
      })
      .join(PARA_DELIM)
      ;
    const args = { content };
    let sessionInput;
    try {
      const { response, errors } = await executionsService.executeFunction({
        workspaceId: values.workspaceId,
        username,
        semanticFunctionName: 'create_summary_label',
        args,
        params: {},
      });
      if (errors) {
        res.status(500).send({ errors });
      }
      const name = response.choices[0].message.content;
      logger.debug('name:', name);
      sessionInput = { ...values, id, name };
    } catch (err) {
      logger.warn(err);
      // skip name
      sessionInput = { ...values, id };
    }
    const session = await chatSessionsService.upsertChatSession(sessionInput, username);
    res.json(session);
  });

  /**
   * @openapi
   * /api/chat-sessions/:id:
   *   delete:
   *     description: Delete an chat session.
   *     tags: [ChatSessions]
   *     parameters:
   *       - name: id
   *         description: The session id
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
  app.delete('/api/chat-sessions/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    await chatSessionsService.deleteChatSessions([id]);
    res.json(id);
  });

  /**
   * @openapi
   * /api/chat-sessions:
   *   delete:
   *     description: Delete multiple chat sessions
   *     tags: [ChatSessions]
   *     parameters:
   *       - name: ids
   *         description: A comma separated list of ids
   *         in: query
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: The deleted session ids
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: string
   *       500:
   *         description: Error
   */
  app.delete('/api/chat-sessions', auth, async (req, res, next) => {
    const ids = req.query.ids.split(',');
    await chatSessionsService.deleteChatSessions(ids);
    res.json(ids);
  });

};
