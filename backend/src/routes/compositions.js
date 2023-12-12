import searchFunctions from '../searchFunctions';

export default ({ app, auth, constants, logger, services }) => {

  const OBJECT_TYPE = 'compositions';

  const { compositionsService } = services;

  const { deleteObjects, deleteObject, indexObject } = searchFunctions({ constants, services });

  /**
   * @openapi
   * components:
   *   schemas:
   *     Edge:
   *       type: object
   *       required:
   *         - id
   *         - source
   *         - target
   *       properties:
   *         id:
   *           description: Edge id.
   *           type: string
   *         source:
   *           description: Source Node id.
   *           type: string
   *         sourceHandle:
   *           description: Source Handle alias.
   *           type: string
   *         target:
   *           description: Target Node id.
   *           type: string
   *         targetHandle:
   *           description: Target Handle alias.
   *           type: string
   *       example:
   *         id: "reactflow__edge-b30111e5-7efb-457e-be93-cb09cf04a8c7a-b35187e1-da6f-4064-8968-34a035638fa4target"
   *         source: "b30111e5-7efb-457e-be93-cb09cf04a8c7"
   *         sourceHandle: "a"
   *         target: "b35187e1-da6f-4064-8968-34a035638fa4"
   *         targetHandle: "target"
   * 
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
   *       required:
   *         - label
   *       properties:
   *         label:
   *           type: string
   *           description: The title on the visual component
   *         arguments:
   *           type: JSONObject
   *           description: A JSONSchema definition of the request arguments.
   *       example:
   *         label: "Request"
   *         arguments:
   *           type: object
   *           properties:
   *             input:
   *               type: string
   *           required:
   *             - input
   * 
   *     FunctionNodeData:
   *       type: object
   *       required:
   *         - functionId
   *         - functionName
   *       properties:
   *         functionId:
   *           type: integer
   *           description: The id of the semantic function
   *         functionName:
   *           type: string
   *           description: The name of the semantic function
   *       example:
   *         functionId: 1
   *         functionName: "summarize"
   * 
   *     MapperNodeData:
   *       type: object
   *       required:
   *         - returnType
   *       properties:
   *         mappingData:
   *           type: string
   *           description: The mapping specification
   *         returnType:
   *           type: string
   *           description: The mime type returned by the mapper.
   *         returnTypeSchema:
   *           type: JSONObject
   *           description: A JSONSchema definition of the return type.
   *       example:
   *         mappingData: "{\n    text: 'input'\n}"
   *         returnType: "application/json"
   *         returnTypeSchema:
   *           type: object
   *           properties:
   *             text:
   *               type: string
   *           required:
   *             - text
   * 
   *     JoinerNodeData:
   *       type: object
   * 
   *     OutputNodeData:
   *       type: object
   * 
   *     Node:
   *       type: object
   *       properties:
   *         id:
   *           type: string
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
   *           oneOf:
   *             - $ref: '#/components/schema/RequestNodeData'
   *             - $ref: '#/components/schema/FunctionNodeData'
   *             - $ref: '#/components/schema/MapperNodeData'
   *             - $ref: '#/components/schema/JoinerNodeData'
   *             - $ref: '#/components/schema/OutputNodeData'
   *           description: The node data.
   *         width:
   *           type: integer
   *           description: Width of the visual component on the canvas.
   *         height:
   *           type: integer
   *           description: Height of the visual component on the canvas.
   *         position:
   *           $ref: '#/components/schemas/NodePosition'
   *           description: The position of the visual component on the canvas.
   *         positionAbsolute:
   *           $ref: '#/components/schemas/NodePosition'
   *           description: The absolute position of the visual component on the canvas.
   *         selected:
   *           type: boolean
   *           description: A flag to indicate if the visual component has been selected.
   *         dragging:
   *           type: boolean
   *           description: A flag to indicate if the visual component is currently being dragged to a new position.
   *         zIndex:
   *           type: number
   *           description: Defines the order of overlapping elements.
   *       example:
   *         data:
   *           functionId: 1
   *           functionName: "summarize"
   *         dragging: false
   *         height: 62
   *         id: "96ae6c8c-6bb5-4aa0-94fb-058505d7c1e4"
   *         position:
   *           x: 255
   *           y: 180
   *         positionAbsolute:
   *           x: 255
   *           y: 180
   *         selected: false
   *         type: "functionNode"
   *         width: 150
   *         zIndex: 1001
   * 
   *     Viewport:
   *       type: object
   *       requires:
   *         - x
   *         - y
   *         - zoom
   *       properties:
   *         x:
   *           description: The position on the horizontal plane.
   *           type: number
   *         y:
   *           description: The position on the vertical plane.
   *           type: number
   *         zoom:
   *           description: The zoom factor
   *           type: number
   *       example:
   *         x: 0
   *         y: 0
   *         zoom: 1.5
   * 
   *     Flow:
   *       type: object
   *       required:
   *         - nodes
   *       properties:
   *         nodes:
   *           description: The set of execution steps.
   *           type: array
   *           items:
   *             $ref: '#/components/schemas/Node'
   *         edges:
   *           description: The set of edges connecting nodes in the flow that represent execution dependencies.
   *           type: array
   *           items:
   *             $ref: '#/components/schemas/Edge'
   *         viewport:
   *           description: The current display properties
   *           $ref: '#/components/schemas/Viewport'
   *       example:
   *         edges:
   *           - id: "reactflow__edge-b30111e5-7efb-457e-be93-cb09cf04a8c7a-b35187e1-da6f-4064-8968-34a035638fa4target"
   *             source: "b30111e5-7efb-457e-be93-cb09cf04a8c7"
   *             sourceHandle: "a"
   *             target: "b35187e1-da6f-4064-8968-34a035638fa4"
   *             targetHandle: "target"
   *         nodes:
   *           - data:
   *               functionId: 1
   *               functionName: "summarize"
   *             dragging: false
   *             height: 62
   *             id: "96ae6c8c-6bb5-4aa0-94fb-058505d7c1e4"
   *             position:
   *               x: 255
   *               y: 180
   *             positionAbsolute:
   *               x: 255
   *               y: 180
   *             selected: false
   *             type: "functionNode"
   *             width: 150
   *             zIndex: 1001
   *         viewport:
   *           x: 0
   *           y: 0
   *           zoom: 1.5
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
   *           $ref: '#/components/schemas/Flow'
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
   *         returnType:
   *           type: string
   *           description: The mime type returned by the composition.
   *       example:
   *         id: 1
   *         workspaceId: 2
   *         name: "Test Composition"
   *         returnType: "application/json"
   *         created: "2023-10-01T16:52:22.000Z"
   *         createdBy: "test.account@promptstore.dev"
   *         modified: "2023-10-01T17:29:47.000Z"
   *         modifiedBy: "test.account@promptstore.dev"
   *         flow:
   *           edges:
   *             - id: "reactflow__edge-b30111e5-7efb-457e-be93-cb09cf04a8c7a-b35187e1-da6f-4064-8968-34a035638fa4target"
   *               source: "b30111e5-7efb-457e-be93-cb09cf04a8c7"
   *               sourceHandle: "a"
   *               target: "b35187e1-da6f-4064-8968-34a035638fa4"
   *               targetHandle: "target"
   *           nodes:
   *             - data:
   *                 functionId: 1
   *                 functionName: "summarize"
   *               dragging: false
   *               height: 62
   *               id: "96ae6c8c-6bb5-4aa0-94fb-058505d7c1e4"
   *               position:
   *                 x: 255
   *                 y: 180
   *               positionAbsolute:
   *                 x: 255
   *                 y: 180
   *               selected: false
   *               type: "functionNode"
   *               width: 150
   *               zIndex: 1001
   *           viewport:
   *             x: 0
   *             y: 0
   *             zoom: 1.5
   * 
   *     CompositionInput:
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
   *           description: The composition name.
   *         flow:
   *           $ref: '#/components/schemas/Flow'
   *           description: The composition flow.
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
   *   name: Compositions
   *   description: The Composition Management API
   */

  /**
   * @openapi
   * /api/workspaces/{workspaceId}/compositions:
   *   get:
   *     description: List all the compositions in the given workspace.
   *     tags: [Compositions]
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
   *         description: The list of compositions
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Composition'
   *       500:
   *         description: Error
   */
  app.get('/api/workspaces/:workspaceId/compositions', auth, async (req, res, next) => {
    const { workspaceId } = req.params;
    const compositions = await compositionsService.getCompositions(workspaceId);
    res.json(compositions);
  });

  /**
   * @openapi
   * /api/compositions/{id}:
   *   get:
   *     description: Lookup a composition by id.
   *     tags: [Compositions]
   *     produces:
   *       application/json
   *     parameters:
   *       - name: id
   *         description: The composition id
   *         in: path
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: The composition
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Composition'
   *       500:
   *         description: Error
   */
  app.get('/api/compositions/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    const composition = await compositionsService.getComposition(id);
    res.json(composition);
  });

  /**
   * @openapi
   * /api/compositions:
   *   post:
   *     description: Create a new composition.
   *     tags: [Compositions]
   *     requestBody:
   *       description: The new composition values
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CompositionInput'
   *     responses:
   *       200:
   *         description: The new composition
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Composition'
   *       500:
   *         description: Error
   */
  app.post('/api/compositions', auth, async (req, res, next) => {
    const { username } = req.user;
    const values = req.body;
    const composition = await compositionsService.upsertComposition(values, username);
    const obj = createSearchableObject(composition);
    await indexObject(obj);
    res.json(composition);
  });

  /**
   * @openapi
   * /api/compositions/{id}:
   *   put:
   *     description: Update a composition.
   *     tags: [Compositions]
   *     parameters:
   *       - name: id
   *         description: The composition id
   *         in: path
   *         schema:
   *           type: integer
   *     requestBody:
   *       description: The updated composition values
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CompositionInput'
   *     responses:
   *       200:
   *         description: The updated composition
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Composition'
   *       500:
   *         description: Error
   */
  app.put('/api/compositions/:id', auth, async (req, res, next) => {
    const { id } = req.params;
    const { username } = req.user;
    const values = req.body;
    const composition = await compositionsService.upsertComposition({ ...values, id }, username);
    const obj = createSearchableObject(composition);
    await indexObject(obj);
    res.json(composition);
  });

  /**
   * @openapi
   * /api/compositions/{id}:
   *   delete:
   *     description: Delete a composition.
   *     tags: [Compositions]
   *     parameters:
   *       - name: id
   *         description: The composition id
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
  app.delete('/api/compositions/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    await compositionsService.deleteCompositions([id]);
    await deleteObject(objectId(id));
    res.json(id);
  });

  /**
   * @openapi
   * /api/compositions:
   *   delete:
   *     description: Delete multiple compositions
   *     tags: [Compositions]
   *     parameters:
   *       - name: ids
   *         description: A comma separated list of ids
   *         in: query
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: The deleted composition ids
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: string
   *       500:
   *         description: Error
   */
  app.delete('/api/compositions', auth, async (req, res, next) => {
    const ids = req.query.ids.split(',');
    await compositionsService.deleteCompositions(ids);
    await deleteObjects(ids.map(objectId));
    res.json(ids);
  });

  const objectId = (id) => OBJECT_TYPE + ':' + id;

  function createSearchableObject(rec) {
    const texts = [
      rec.name,
      rec.description,
    ];
    const text = texts.filter(t => t).join('\n');
    return {
      id: objectId(rec.id),
      nodeLabel: 'Object',
      label: 'Composition',
      type: OBJECT_TYPE,
      name: rec.name,
      text,
      createdDateTime: rec.created,
      createdBy: rec.createdBy,
      workspaceId: String(rec.workspaceId),
      metadata: {
      },
    };
  }

};
