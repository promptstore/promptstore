module.exports = ({ app, auth, logger, services }) => {

  const { workspacesService, usersService } = services;

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
   *           description: The username of the user who kast modified the workspace.
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
   *               type: string
   *       500:
   *         description: Error
   */
  app.post('/api/workspaces', auth, async (req, res, next) => {
    const values = req.body;
    const id = await workspacesService.upsertWorkspace(values);
    res.json(id);
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
   *       description: The new workspace values
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
    const id = req.params.id;
    const values = req.body;
    await workspacesService.upsertWorkspace({ id, ...values });
    res.json({ status: 'OK' });
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
   *       description: The new workspace values
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

};