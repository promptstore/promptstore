export default ({ app, auth, constants, logger, pg, services }) => {

  const { destinationsService, sqlSourceService } = services;

  /**
   * @openapi
   * components:
   *   schemas:
   *     Destination:
   *       type: object
   *       required:
   *         - id
   *         - workspaceId
   *         - name
   *         - type
   *       properties:
   *         id:
   *           type: integer
   *           description: The auto-generated id of the destination
   *         workspaceId:
   *           type: integer
   *           description: The destination id
   *         name:
   *           type: string
   *           description: The destination name.
   *         description:
   *           type: string
   *           description: A description of the destination
   *         type:
   *           type: string
   *           enum:
   *             - document
   *             - sql
   *           description: The destination type.
   *         dialect:
   *           type: string
   *           enum:
   *             - postgresql
   *           description: The database type (if type=sql).
   *         connectionString:
   *           type: string
   *           description: The connection string to access the database destination (if type=sql).
   *         username:
   *           type: string
   *           description: The database username with permission to access the database destination (if type=sql).
   *         password:
   *           type: string
   *           description: The password to access the database destination (if type=sql).
   *         dataset:
   *           type: string
   *           description: The name of the dataset or schema to use to store the output.
   *         tableName:
   *           type: string
   *           description: The name of the table to use or create to store the output.
   *         created:
   *           type: string
   *           format: date
   *           description: The date-time the destination was created
   *         createdBy:
   *           type: string
   *           description: The username of the user who created the destination.
   *         modified:
   *           type: string
   *           format: date
   *           description: The date-time the destination was last modified
   *         modifiedBy:
   *           type: string
   *           description: The username of the user who last modified the destination.
   *       examples:
   *         sql:
   *           id: 12
   *           workspaceId: 2
   *           name: Scored users table
   *           description: A table of scored users.
   *           type: sql
   *           dialect: BigQuery
   *           dataset: online_users
   *           table_name: scored_users
   *           created: 2023-03-01T10:30
   *           createdBy: markmo@acme.com
   *           modified: 2023-03-01T10:30
   *           modifiedBy: markmo@acme.com
   * 
   *     DestinationInput:
   *       type: object
   *       required:
   *         - workspaceId
   *         - name
   *         - type
   *       properties:
   *         workspaceId:
   *           type: integer
   *           description: The destination id
   *         name:
   *           type: string
   *           description: The destination name.
   *         description:
   *           type: string
   *           description: A description of the destination
   *         type:
   *           type: string
   *           enum:
   *             - document
   *             - sql
   *           description: The destination type.
   *         dialect:
   *           type: string
   *           enum:
   *             - postgresql
   *           description: The database type (if type=sql).
   *         connectionString:
   *           type: string
   *           description: The connection string to access the database destination (if type=sql).
   *         username:
   *           type: string
   *           description: The database username with permission to access the database destination (if type=sql).
   *         password:
   *           type: string
   *           description: The password to access the database destination (if type=sql).
   *         dataset:
   *           type: string
   *           description: The name of the dataset or schema to use to store the output.
   *         tableName:
   *           type: string
   *           description: The name of the table to use or create to store the output.
   *         createdBy:
   *           type: string
   *           description: The username of the user who created the destination.
   *         modifiedBy:
   *           type: string
   *           description: The username of the user who last modified the destination.
   *       examples:
   *         sql:
   *           workspaceId: 2
   *           name: Scored users table
   *           description: A table of scored users.
   *           type: sql
   *           dialect: BigQuery
   *           dataset: online_users
   *           table_name: scored_users
   *           createdBy: markmo@acme.com
   *           modifiedBy: markmo@acme.com
   */

  /**
   * @openapi
   * tags:
   *   name: Destinations
   *   description: The Destinations Management API
   */

  /**
   * @openapi
   * /api/workspaces/{workspaceId}/destinations:
   *   get:
   *     description: List all the destinations in the given workspace.
   *     tags: [Destinations]
   *     produces:
   *       - application/json
   *     parameters:
   *       - name: workspaceId
   *         description: The workspace id.
   *         in: path
   *         schema:
   *           type: integer
   *       - name: type
   *         description: filter by source type
   *         in: query
   *         schema:
   *           type: string
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
   *         description: The list of destinations
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Destination'
   *       500:
   *         description: Error
   */
  app.get('/api/workspaces/:workspaceId/destinations', auth, async (req, res, next) => {
    const { workspaceId } = req.params;
    const { type } = req.query;
    let destinations;
    if (type) {
      destinations = await destinationsService.getDestinationsByType(workspaceId, type);
    } else {
      destinations = await destinationsService.getDestinations(workspaceId);
    }
    res.json(destinations);
  });

  /**
   * @openapi
   * /api/destinations/{id}:
   *   get:
   *     description: Lookup a destination by id.
   *     tags: [Destinations]
   *     produces:
   *       application/json
   *     parameters:
   *       - name: id
   *         description: The destination id
   *         in: path
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: The destination
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Destination'
   *       500:
   *         description: Error
   */
  app.get('/api/destinations/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    const index = await destinationsService.getDestination(id);
    res.json(index);
  });

  /**
   * @openapi
   * /api/destinations:
   *   post:
   *     description: Create a new destination.
   *     tags: [Destinations]
   *     requestBody:
   *       description: The new destination values
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/DestinationInput'
   *     responses:
   *       200:
   *         description: The new destination
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Destination'
   *       500:
   *         description: Error
   */
  app.post('/api/destinations', auth, async (req, res, next) => {
    const { username } = req.user;
    const values = req.body;
    const destination = await destinationsService.upsertDestination(values, username);
    res.json(destination);
  });

  /**
   * @openapi
   * /api/destinations/{id}:
   *   put:
   *     description: Update a destination.
   *     tags: [Destinations]
   *     parameters:
   *       - name: id
   *         description: The destination id
   *         in: path
   *         schema:
   *           type: integer
   *     requestBody:
   *       description: The updated destination values
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/DestinationInput'
   *     responses:
   *       200:
   *         description: The updated destination
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Destination'
   *       500:
   *         description: Error
   */
  app.put('/api/destinations/:id', auth, async (req, res, next) => {
    const { id } = req.params;
    const { username } = req.user;
    const values = req.body;
    const destination = await destinationsService.upsertDestination({ ...values, id }, username);
    res.json(destination);
  });

  /**
   * @openapi
   * /api/destinations/{id}:
   *   delete:
   *     description: Delete a destination.
   *     tags: [Destinations]
   *     parameters:
   *       - name: id
   *         description: The destination id
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
  app.delete('/api/destinations/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    await destinationsService.deleteDestinations([id]);
    res.json(id);
  });

  /**
   * @openapi
   * /api/destinations:
   *   delete:
   *     description: Delete multiple destinations
   *     tags: [Destinations]
   *     parameters:
   *       - name: ids
   *         description: A comma separated list of ids
   *         in: query
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: The deleted destination ids
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: string
   *       500:
   *         description: Error
   */
  app.delete('/api/destinations', auth, async (req, res, next) => {
    const ids = req.query.ids.split(',');
    await destinationsService.deleteDestinations(ids);
    res.json(ids);
  });

};
