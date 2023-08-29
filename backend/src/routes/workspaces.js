export default ({ app, auth, constants, logger, services }) => {

  const { emailService, usersService, workspacesService } = services;

  /**
   * @openapi
   * components:
   *   schemas:
   *     Member:
   *       type: object
   *       required:
   *         - id
   *         - username
   *       properties:
   *         id:
   *           type: integer
   *           description: The auto-generated id of the user
   *         username:
   *           type: string
   *           description: The username
   *         fullName:
   *           type: string
   *           description: The user's full name
   *         email:
   *           type: string
   *           description: The user's email address
   *     
   *     Workspace:
   *       type: object
   *       required:
   *         - id
   *         - name
   *       properties:
   *         id:
   *           type: integer
   *           description: The auto-generated id of the workspace
   *         name:
   *           type: string
   *           description: The workspace name.
   *         description:
   *           type: string
   *           description: A description of the workspace's mission
   *         members:
   *           type: array
   *           items:
   *             type: Member
   *           description: The list of members in the workspace
   *         created:
   *           type: string
   *           format: date
   *           description: The date-time the workspace was created
   *         createdBy:
   *           type: string
   *           description: The username of the user who created the workspace.
   *         modified:
   *           type: string
   *           format: date
   *           description: The date-time the workspace was last modified
   *         modifiedBy:
   *           type: string
   *           description: The username of the user who last modified the workspace.
   *       example:
   *         id: 1
   *         name: J08 - X-sell Mobile
   *         description: Cross-sell Mobile to the Broadband Base. Our mission is to drive the adoption of Mobile into our Broadband Base.
   *         members:
   *           - id: 7
   *             username: markmo@acme.com
   *             fullName: Mark Mo
   *             email: markmo@acme.com
   *         created: 2023-03-01T10:30
   *         createdBy: markmo@acme.com
   *         modified: 2023-03-01T10:30
   *         modifiedBy: markmo@acme.com
   * 
   *     WorkspaceInput:
   *       type: object
   *       required:
   *         - name
   *       properties:
   *         name:
   *           type: string
   *           description: The workspace name.
   *         description:
   *           type: string
   *           description: A description of the workspace's mission
   *         members:
   *           type: array
   *           items:
   *             type: Member
   *           description: The list of members containing the owner
   *         createdBy:
   *           type: string
   *           description: The username of the user who created the workspace.
   *         modifiedBy:
   *           type: string
   *           description: The username of the user who last modified the workspace.
   *       example:
   *         name: J08 - X-sell Mobile
   *         description: Cross-sell Mobile to the Broadband Base. Our mission is to drive the adoption of Mobile into our Broadband Base.
   *         members:
   *           - id: 7
   *             username: markmo@acme.com
   *             fullName: Mark Mo
   *             email: markmo@acme.com
   *         createdBy: markmo@acme.com
   *         modifiedBy: markmo@acme.com
   *
   *     Status:
   *       type: object
   *       properties:
   *         status:
   *           type: string
   *           description: The status - OK
   * 
   *     User:
   *       type: object
   *       required:
   *         - username
   *       properties:
   *         username:
   *           type: string
   *           description: The username
   *         roles:
   *           type: array
   *           items:
   *             type: string
   *           description: The list of roles assigned to the user
   */

  /**
   * @openapi
   * tags:
   *   name: Workspaces
   *   description: The Workspace Management API
   */

  /**
   * @openapi
   * /api/workspaces:
   *   get:
   *     description: List all the workspaces available to the given user.
   *     tags: [Workspaces]
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
   *         description: The list of workspaces
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Workspace'
   *       500:
   *         description: Error
   */
  app.get('/api/workspaces', auth, async (req, res, next) => {
    const query = { ...req.query };
    const limit = query.limit;
    const start = query.start;
    delete query.limit;
    delete query.start;
    const user = await usersService.getUser(req.user.username);
    let workspaces;
    if (user.roles && user.roles.indexOf['admin'] !== -1) {
      workspaces = await workspacesService.getWorkspaces(limit, start);
    } else {
      workspaces = await workspacesService.getWorkspacesByUser(user.id, limit, start);
    }
    res.json(workspaces);
  });

  /*
  req.user: {
  name: 'Mark Mo',
  picture: 'https://avatars.dicebear.com/api/gridy/0.XXX4164767352256.svg',
  iss: 'https://securetoken.google.com/XXX',
  aud: 'XXX',
  auth_time: 1691469874,
  user_id: 'XXX',
  sub: 'XXX',
  iat: 1691469874,
  exp: 1691473474,
  email: 'markmo@acme.com',
  email_verified: false,
  firebase: { identities: { email: [Array] }, sign_in_provider: 'password' },
  uid: 'XXX'
}

  */

  /**
   * @openapi
   * /api/workspaces/:id:
   *   get:
   *     description: Lookup a workspace by id.
   *     tags: [Workspaces]
   *     produces:
   *       application/json
   *     parameters:
   *       - name: id
   *         description: The workspace id
   *         in: path
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: The workspace
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Workspace'
   *       500:
   *         description: Error
   */
  app.get('/api/workspaces/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    const workspace = await workspacesService.getWorkspace(id);
    res.json(workspace);
  });

  app.post('/api/workspaces/:workspaceId/keys', auth, async (req, res) => {
    const { workspaceId } = req.params;
    const { username } = req.user;
    const { apiKey } = req.body;
    const workspace = await workspacesService.getWorkspace(workspaceId);
    const apiKeys = workspace.apiKeys || {};
    const key = Object.keys(apiKeys).find(k => apiKeys[k] === username);
    if (key) {
      delete apiKeys[key];
    }
    const values = {
      ...workspace,
      apiKeys: {
        ...apiKeys,
        [apiKey]: username,
      },
    };
    await workspacesService.upsertWorkspace(values, username);
    res.json({ status: 'OK' });
  });

  app.delete('/api/workspaces/:workspaceId/keys', auth, async (req, res) => {
    const { workspaceId } = req.params;
    const { username } = req.user;
    const workspace = await workspacesService.getWorkspace(workspaceId);
    const apiKeys = workspace.apiKeys;
    if (apiKeys) {
      const key = Object.keys(apiKeys).find(k => apiKeys[k] === username);
      if (key) {
        delete apiKeys[key];
        const values = {
          ...workspace,
          apiKeys,
        };
        await workspacesService.upsertWorkspace(values, username);
      }
    }
    res.json({ status: 'OK' });
  });

  /**
   * @openapi
   * /api/workspaces:
   *   post:
   *     description: Create a new workspace.
   *     tags: [Workspaces]
   *     requestBody:
   *       description: The new workspace values
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/WorkspaceInput'
   *     responses:
   *       200:
   *         description: The new workspace id
   *         content:
   *           text/plain:
   *             schema:
   *               type: integer
   *       500:
   *         description: Error
   */
  app.post('/api/workspaces', auth, async (req, res, next) => {
    const values = req.body;
    const user = await usersService.getUser(req.user.username);
    const workspace = await workspacesService.upsertWorkspace(values, user);
    res.json(workspace);
  });

  /**
   * @openapi
   * /api/workspaces/:id:
   *   put:
   *     description: Update a workspace.
   *     tags: [Workspaces]
   *     parameters:
   *       - name: id
   *         description: The workspace id
   *         in: path
   *         schema:
   *           type: integer
   *     requestBody:
   *       description: The updated workspace values
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/WorkspaceInput'
   *     responses:
   *       200:
   *         description: The return status
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Status'
   *       500:
   *         description: Error
   */
  app.put('/api/workspaces/:id', auth, async (req, res, next) => {
    const { id } = req.params;
    const values = req.body;
    const user = await usersService.getUser(req.user.username);
    const workspace = await workspacesService.upsertWorkspace({ id, ...values }, user);
    res.json(workspace);
  });

  /**
   * @openapi
   * /api/workspaces/:id:
   *   delete:
   *     description: Delete a workspace.
   *     tags: [Workspaces]
   *     parameters:
   *       - name: id
   *         description: The workspace id
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
  app.delete('/api/workspaces/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    await workspacesService.deleteWorkspaces([id]);
    res.json(id);
  });

  /**
   * @openapi
   * /api/workspaces:
   *   delete:
   *     description: Delete multiple workspaces
   *     tags: [Workspaces]
   *     parameters:
   *       - name: ids
   *         description: A comma separated list of ids
   *         in: query
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: The deleted workspace ids
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: string
   *       500:
   *         description: Error
   */
  app.delete('/api/workspaces', auth, async (req, res, next) => {
    const ids = req.query.ids.split(',');
    await workspacesService.deleteWorkspaces(ids);
    res.json(ids);
  });

  app.post('/api/invites', auth, async (req, res) => {
    logger.debug('req.user:', req.user);
    const { workspaceId, invites } = req.body;
    const members = [];
    for (const email of invites) {
      const user = await usersService.getUserByEmail(email);
      logger.debug('found existing user:', user || 'No');
      if (user) {
        const { id, fullName, email, username } = user;
        members.push({ id, fullName, email, username });
      } else {
        const newUser = await usersService.upsertUser({ username: email, email, fullName: email });
        logger.debug('newUser:', newUser);
        members.push({
          id: newUser.id,
          email,
          username: email,
          fullName: email,
        });
        await emailService.send(
          email,
          constants.MAILTRAP_INVITE_TEMPLATE_UUID,
          { fullName: req.user.fullName },
        );
      }
    }
    logger.debug('members:', members);
    if (members.length) {
      const savedWorkspace = await workspacesService.getWorkspace(workspaceId);
      const savedMemberEmails = savedWorkspace.members.map(m => m.email);
      const newMembers = members.filter(m => savedMemberEmails.indexOf(m.email) === -1);
      const workspace = {
        ...savedWorkspace,
        members: [...savedWorkspace.members, ...newMembers],
      };
      const updatedWorkspace = await workspacesService.upsertWorkspace(workspace, req.user);
      res.json(updatedWorkspace);
    } else {
      res.sendStatus(404);
    }
  });

};
