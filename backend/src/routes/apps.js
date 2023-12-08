export default ({ app, auth, logger, services }) => {

  const { appsService } = services;

  /**
   * @openapi
   * components:
   *   schemas:
   *     App:
   *       type: object
   *       required:
   *         - id
   *         - workspaceId
   *         - name
   *       properties:
   *         id:
   *           type: integer
   *           description: The auto-generated id of the app
   *         workspaceId:
   *           type: integer
   *           description: The workspace id
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
   *         created:
   *           type: string
   *           format: date
   *           description: The date-time the app was created
   *         createdBy:
   *           type: string
   *           description: The username of the user who created the app.
   *         modified:
   *           type: string
   *           format: date
   *           description: The date-time the app was last modified
   *         modifiedBy:
   *           type: string
   *           description: The username of the user who last modified the app.
   *       example:
   *         id: 1
   *         workspaceId: 1
   *         name: AGENCEE
   *         description: Generate marketing copy.
   *         promptSets: [3,24]
   *         functions: [6,20]
   *         dataSources: [11]
   *         indexes: [42]
   *         created: 2023-03-01T10:30
   *         createdBy: markmo@acme.com
   *         modified: 2023-03-01T10:30
   *         modifiedBy: markmo@acme.com
   * 
   *     AppInput:
   *       type: object
   *       required:
   *         - workspaceId
   *         - name
   *       properties:
   *         workspaceId:
   *           type: integer
   *           description: The workspace id
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
   *         workspaceId: 1
   *         name: AGENCEE
   *         description: Generate marketing copy.
   *         promptSets: [3,24]
   *         functions: [6,20]
   *         dataSources: [11]
   *         indexes: [42]
   *         createdBy: markmo@acme.com
   *         modifiedBy: markmo@acme.com
   */

  /**
   * @openapi
   * tags:
   *   name: Apps
   *   description: The App Management API
   */

  /**
   * @openapi
   * /api/workspaces/{workspaceId}/apps:
   *   get:
   *     description: List all the apps in the given workspace.
   *     tags: [Apps]
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
   *         description: The list of apps
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/App'
   *       500:
   *         description: Error
   */
  app.get('/api/workspaces/:workspaceId/apps', auth, async (req, res, next) => {
    const { workspaceId } = req.params;
    const { limit, start } = req.query;
    const apps = await appsService.getApps(workspaceId, limit, start);
    res.json(apps);
  });

  /**
   * @openapi
   * /api/apps/{id}:
   *   get:
   *     description: Lookup an app by id.
   *     tags: [Apps]
   *     produces:
   *       application/json
   *     parameters:
   *       - name: id
   *         description: The app id
   *         in: path
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: The app
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/App'
   *       500:
   *         description: Error
   */
  app.get('/api/apps/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    const app = await appsService.getApp(id);
    res.json(app);
  });

  /**
   * @openapi
   * /api/apps:
   *   post:
   *     description: Create a new app.
   *     tags: [Apps]
   *     requestBody:
   *       description: The new app values
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/AppInput'
   *     responses:
   *       200:
   *         description: The new app
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/App'
   *       500:
   *         description: Error
   */
  app.post('/api/apps', auth, async (req, res, next) => {
    const { username } = req.user;
    const values = req.body;
    const app = await appsService.upsertApp(values, username);
    res.json(app);
  });

  /**
   * @openapi
   * /api/apps/{id}:
   *   put:
   *     description: Update an app.
   *     tags: [Apps]
   *     parameters:
   *       - name: id
   *         description: The app id
   *         in: path
   *         schema:
   *           type: integer
   *     requestBody:
   *       description: The updated app values
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/AppInput'
   *     responses:
   *       200:
   *         description: The updated app
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/App'
   *       500:
   *         description: Error
   */
  app.put('/api/apps/:id', auth, async (req, res, next) => {
    const { id } = req.params;
    const { username } = req.user;
    const values = req.body;
    const app = await appsService.upsertApp({ ...values, id }, username);
    res.json(app);
  });

  /**
   * @openapi
   * /api/apps/{id}:
   *   delete:
   *     description: Delete an app.
   *     tags: [Apps]
   *     parameters:
   *       - name: id
   *         description: The app id
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
  app.delete('/api/apps/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    await appsService.deleteApps([id]);
    res.json(id);
  });

  /**
   * @openapi
   * /api/apps:
   *   delete:
   *     description: Delete multiple apps
   *     tags: [Apps]
   *     parameters:
   *       - name: ids
   *         description: A comma separated list of ids
   *         in: query
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: The deleted app ids
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: string
   *       500:
   *         description: Error
   */
  app.delete('/api/apps', auth, async (req, res, next) => {
    const ids = req.query.ids.split(',');
    await appsService.deleteApps(ids);
    res.json(ids);
  });

};
