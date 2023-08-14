export default ({ app, auth, logger, services }) => {

  const { compositionsService } = services;

  /**
   * @openapi
   * components:
   *   schemas:
   *     NodePosition:
   *       type: object
   *       required:
   *         - x
   *         - y
   *       properties:
   *         x:
   *           type: integer
   *           description: The position of the top-left corner of the visual component along the horizontal axis.
   *         y:
   *           type: integer
   *           description: The position of the top-left corner of the visual component along the vertical axis.
   *       example:
   *         x: 15
   *         y: 20
   * 
   *     RequestNodeData:
   *       type: object
   *       properties:
   *         label:
   *           type: string
   *           description: The title on the visual component
   *         arguments:
   *           type: JSONObject
   *           description: A JSONSchema definition of the request arguments.
   *         position:
   *           type: NodePosition
   *           description: The position of the visual component on the canvas.
   *         positionAbsolute:
   *           type: NodePosition
   *           description: The absolute position of the visual component on the canvas.
   *         selected:
   *           type: boolean
   *           description: A flag to indicate if the visual component has been selected.
   *         dragging:
   *           type: boolean
   *           description: A flag to indicate if the visual component is currently being dragged to a new position.
   * 
   * 
   *     Node:
   *       type: object
   *       properties:
   *         id:
   *           type: integer
   *           description: Node id.
   *         type:
   *           type: string
   *           enum:
   *             - requestNode
   *             - functionNode
   *             - mapperNode
   *             - joinerNode
   *             - outputNode
   *           description: The node type
   *         data:
   *           type: NodeData
   *           description: The node data.
   *         width:
   *           type: integer
   *           description: Width of the visual component on the canvas.
   *         height:
   *           type: integer
   *           description: Height of the visual component on the canvas.
   *         
   * 
   *     Flow:
   *       type: object
   *       required:
   *         - nodes
   *       properties:
   *         nodes:
   *           type: array
   *           items:
   *             $ref: '#/components/schemas/Node'
   * 
   *     Composition:
   *       type: object
   *       required:
   *         - id
   *         - workspaceId
   *         - name
   *       properties:
   *         id:
   *           type: integer
   *           description: The auto-generated id of the composition
   *         workspaceId:
   *           type: integer
   *           description: The workspace id
   *         name:
   *           type: string
   *           description: The composition name.
   *         flow:
   *           type: Flow
   *           description: The composition flow.
   *         description:
   *           type: string
   *           description: A description of the composition
   *         created:
   *           type: string
   *           format: date
   *           description: The date-time the composition was created
   *         createdBy:
   *           type: string
   *           description: The username of the user who created the composition.
   *         modified:
   *           type: string
   *           format: date
   *           description: The date-time the composition was last modified
   *         modifiedBy:
   *           type: string
   *           description: The username of the user who last modified the composition.
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
   *         created: 2023-03-01T10:30
   *         createdBy: markmo@acme.com
   *         modified: 2023-03-01T10:30
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
   * /api/workspaces/:workspaceId/apps:
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
  app.get('/api/workspaces/:workspaceId/compositions', auth, async (req, res, next) => {
    const { workspaceId } = req.params;
    const compositions = await compositionsService.getCompositions(workspaceId);
    res.json(compositions);
  });

  app.get('/api/compositions/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    const composition = await compositionsService.getComposition(id);
    res.json(composition);
  });

  app.post('/api/compositions', auth, async (req, res, next) => {
    const { username } = req.user;
    const values = req.body;
    const composition = await compositionsService.upsertComposition(values, username);
    res.json(composition);
  });

  app.put('/api/compositions/:id', auth, async (req, res, next) => {
    const { id } = req.params;
    const { username } = req.user;
    const values = req.body;
    const composition = await compositionsService.upsertComposition({ ...values, id }, username);
    res.json(composition);
  });

  app.delete('/api/compositions/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    await compositionsService.deleteCompositions([id]);
    res.json(id);
  });

  app.delete('/api/compositions', auth, async (req, res, next) => {
    const ids = req.query.ids.split(',');
    await compositionsService.deleteCompositions(ids);
    res.json(ids);
  });

};
