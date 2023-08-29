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
   *           description: The auto-generated id of the data source
   *         workspaceId:
   *           type: integer
   *           description: The data source id
   *         name:
   *           type: string
   *           description: The data source name.
   *         description:
   *           type: string
   *           description: A description of the data source
   *         type:
   *           type: string
   *           enum:
   *             - api
   *             - document
   *             - featurestore
   *             - sql
   *             - crawler
   *           description: The data source type.
   *         documentType:
   *           type: string
   *           enum:
   *             - text
   *             - csv
   *             - epub
   *             - eml
   *             - xlsx
   *             - html
   *             - json
   *             - md
   *             - doc
   *             - docx
   *             - odt
   *             - msg
   *             - pdf
   *             - ppt
   *             - pptx
   *             - rst
   *             - rtf
   *             - tsv
   *             - xml
   *           description: The type (format) of the document (if type=document).
   *         documents:
   *           type: array
   *           items:
   *             type: integer
   *           description: The list of document ids to include in the data source (if type=document).
   *         extractMetadata:
   *           type: boolean
   *           description: A flag to indicate if the document loader will extract metadata from the text using a semantic function (if type=document).
   *         extractSchema:
   *           type: string
   *           description: A JSONSchema that describes the metadata properties to extract from the text (if type=document).
   *         delimiter:
   *           type: string
   *           description: The delimiter character to separate values (if type=document and documentType=csv).
   *         quoteChar:
   *           type: string
   *           description: The character used to mark text values.
   *         textProperty:
   *           type: string
   *           description: The name of the text field (if type=document and documentType=txt).
   *         splitter:
   *           type: string
   *           enum:
   *             - delimiter
   *             - chunker
   *           description: The method to split text into chunks (if type=document and documentType=txt).
   *         characters:
   *           type: string
   *           description: The string to delimit chunks (if type=document and documentType=txt and splitter=delimiter).
   *         chunker:
   *           type: string
   *           description: The semantic function id of the chunker (if type=document and documentType=txt and splitter=chunker).
   *         featurestore:
   *           type: string
   *           enum:
   *             - anaml
   *             - feast
   *             - vertex
   *           description: The feature store provider (if type=featurestore).
   *         httpMethod:
   *           type: string
   *           enum:
   *             - get
   *             - post
   *           description: The HTTP method for the feature store endpoint (if type=featurestore).
   *         url:
   *           type: string
   *           description: The URL of the feature store endpoint (if type=featurestore).
   *         parameterSchema:
   *           type: string
   *           description: The JSONSchema that describes the return parameters from the feature store (if type=featurestore).
   *         appId:
   *           type: string
   *           description: The App ID to access the feature store (if type=featurestore).
   *         appSecret:
   *           type: string
   *           description: The App Secret to access the feature store (if type=featurestore).
   *         featureService:
   *           type: string
   *           description: The name of the Feast Feature Service (if type=featurestore and featurestore=feast). Takes precedence over the feature list.
   *         featureList:
   *           type: string
   *           description: A comma-separated list of feature name identifiers (if type=featurestore and featurestore=feast). Ignored if `featureService` is set.
   *         entity:
   *           type: string
   *           description: The entity type, e.g., customer, driver.
   *         featureStoreName:
   *           type: string
   *           description: The name of the Anaml feature store - equivalent to the Feast feature service (if type=featurestore and featurestore=anaml).
   *         baseUrl:
   *           type: string
   *           description: The root address of the web site to crawl (if type=crawler).
   *         maxRequestsPerCrawl:
   *           type: integer
   *           description: The maximum number of links (requests) to crawl (if type=crawler).
   *         scrapingSpec:
   *           type: string
   *           description: A JSONSchema document that describes what should be extracted from crawled links (if type=crawler).
   *         dialect:
   *           type: string
   *           enum:
   *             - postgresql
   *           description: The database type (if type=sql).
   *         sqlType:
   *           type: string
   *           enum:
   *             - sample
   *             - schema
   *           description: The method used to extract table metadata (if type=sql).
   *         connectionString:
   *           type: string
   *           description: The connection string to access the database source (if type=sql).
   *         username:
   *           type: string
   *           description: The database username with permission to access the database source (if type=sql).
   *         password:
   *           type: string
   *           description: The password to access the database source (if type=sql).
   *         endpoint:
   *           type: string
   *           description: The endpoint URL for the API source (if type=api).
   *         schema:
   *           type: string
   *           description: The JSONSchema that describes the return parameters from the API (if type=api).
   *         created:
   *           type: string
   *           format: date
   *           description: The date-time the data source was created
   *         createdBy:
   *           type: string
   *           description: The username of the user who created the data source.
   *         modified:
   *           type: string
   *           format: date
   *           description: The date-time the data source was last modified
   *         modifiedBy:
   *           type: string
   *           description: The username of the user who last modified the data source.
   *       examples:
   *         document:
   *           id: 16
   *           workspaceId: 1
   *           name: Bond Issue
   *           description: The latest bond issue from Acme Corp.
   *           type: document
   *           documentType: pdf
   *           documents:
   *             - 46
   *           created: 2023-03-01T10:30
   *           createdBy: markmo@acme.com
   *           modified: 2023-03-01T10:30
   *           modifiedBy: markmo@acme.com
   *         text:
   *           id: 15
   *           workspaceId: 1
   *           name: Customer Notes
   *           description: Customer notes.
   *           type: document
   *           documentType: txt
   *           documents:
   *             - 37
   *           textProperty: text
   *           splitter: delimiter
   *           characters: \\n\\n
   *           created: 2023-03-01T10:30
   *           createdBy: markmo@acme.com
   *           modified: 2023-03-01T10:30
   *           modifiedBy: markmo@acme.com
   *         featurestore:
   *           id: 1
   *           workspaceId: 1
   *           name: Driver data
   *           description: Online feature store example.
   *           type: featurestore
   *           featurestore: feast
   *           httpMethod: post
   *           utl: https://feast.acme.com/get-online-features
   *           parametersSchema: "{\"type\":\"array\",\"items\":{\"type\":\"string\",\"title\":\"Entity\",\"description\":\"Entity ID\"},\"title\":\"Request\"}"
   *           featureList: driver_hourly_stats:conv_rate,driver_hourly_stats:acc_rate,driver_hourly_stats:avg_daily_trips
   *           entity: driver_id
   *           featureService: driver_activity
   *           created: 2023-03-01T10:30
   *           createdBy: markmo@acme.com
   *           modified: 2023-03-01T10:30
   *           modifiedBy: markmo@acme.com
   * 
   *     DestinationInput:
   *       type: object
   *       required:
   *         - id
   *         - workspaceId
   *         - name
   *         - type
   *       properties:
   *         id:
   *           type: integer
   *           description: The auto-generated id of the data source
   *         workspaceId:
   *           type: integer
   *           description: The data source id
   *         name:
   *           type: string
   *           description: The data source name.
   *         description:
   *           type: string
   *           description: A description of the data source
   *         type:
   *           type: string
   *           enum:
   *             - api
   *             - document
   *             - featurestore
   *             - sql
   *             - crawler
   *           description: The data source type.
   *         documentType:
   *           type: string
   *           enum:
   *             - text
   *             - csv
   *             - epub
   *             - eml
   *             - xlsx
   *             - html
   *             - json
   *             - md
   *             - doc
   *             - docx
   *             - odt
   *             - msg
   *             - pdf
   *             - ppt
   *             - pptx
   *             - rst
   *             - rtf
   *             - tsv
   *             - xml
   *           description: The type (format) of the document (if type=document).
   *         documents:
   *           type: array
   *           items:
   *             type: integer
   *           description: The list of document ids to include in the data source (if type=document).
   *         extractMetadata:
   *           type: boolean
   *           description: A flag to indicate if the document loader will extract metadata from the text using a semantic function (if type=document).
   *         extractSchema:
   *           type: string
   *           description: A JSONSchema that describes the metadata properties to extract from the text.
   *         delimiter:
   *           type: string
   *           description: The delimiter character to separate values (if type=document and documentType=csv).
   *         quoteChar:
   *           type: string
   *           description: The character used to mark text values.
   *         textProperty:
   *           type: string
   *           description: The name of the text field (if type=document and documentType=txt).
   *         splitter:
   *           type: string
   *           enum:
   *             - delimiter
   *             - chunker
   *           description: The method to split text into chunks (if type=document and documentType=txt).
   *         characters:
   *           type: string
   *           description: The string to delimit chunks (if type=document and documentType=txt and splitter=delimiter).
   *         chunker:
   *           type: string
   *           description: The semantic function id of the chunker (if type=document and documentType=txt and splitter=chunker).
   *         featurestore:
   *           type: string
   *           enum:
   *             - anaml
   *             - feast
   *             - vertex
   *           description: The feature store provider (if type=featurestore).
   *         httpMethod:
   *           type: string
   *           enum:
   *             - get
   *             - post
   *           description: The HTTP method for the feature store endpoint (if type=featurestore).
   *         url:
   *           type: string
   *           description: The URL of the feature store endpoint (if type=featurestore).
   *         parameterSchema:
   *           type: string
   *           description: The JSONSchema that describes the return parameters from the feature store (if type=featurestore).
   *         appId:
   *           type: string
   *           description: The App ID to access the feature store (if type=featurestore).
   *         appSecret:
   *           type: string
   *           description: The App Secret to access the feature store (if type=featurestore).
   *         featureService:
   *           type: string
   *           description: The name of the Feast Feature Service (if type=featurestore and featurestore=feast). Takes precedence over the feature list.
   *         featureList:
   *           type: string
   *           description: A comma-separated list of feature name identifiers (if type=featurestore and featurestore=feast). Ignored if `featureService` is set.
   *         entity:
   *           type: string
   *           description: The entity type, e.g., customer, driver.
   *         featureStoreName:
   *           type: string
   *           description: The name of the Anaml feature store - equivalent to the Feast feature service (if type=featurestore and featurestore=anaml).
   *         baseUrl:
   *           type: string
   *           description: The root address of the web site to crawl (if type=crawler).
   *         maxRequestsPerCrawl:
   *           type: integer
   *           description: The maximum number of links (requests) to crawl (if type=crawler).
   *         scrapingSpec:
   *           type: string
   *           description: A JSONSchema document that describes what should be extracted from crawled links (if type=crawler).
   *         dialect:
   *           type: string
   *           enum:
   *             - postgresql
   *           description: The database type (if type=sql).
   *         sqlType:
   *           type: string
   *           enum:
   *             - sample
   *             - schema
   *           description: The method used to extract table metadata (if type=sql).
   *         connectionString:
   *           type: string
   *           description: The connection string to access the database source (if type=sql).
   *         username:
   *           type: string
   *           description: The database username with permission to access the database source (if type=sql).
   *         password:
   *           type: string
   *           description: The password to access the database source (if type=sql).
   *         endpoint:
   *           type: string
   *           description: The endpoint URL for the API source (if type=api).
   *         schema:
   *           type: string
   *           description: The JSONSchema that describes the return parameters from the API (if type=api).
   *         createdBy:
   *           type: string
   *           description: The username of the user who created the data source.
   *         modifiedBy:
   *           type: string
   *           description: The username of the user who last modified the data source.
   *       examples:
   *         document:
   *           id: 16
   *           workspaceId: 1
   *           name: Bond Issue
   *           description: The latest bond issue from Acme Corp.
   *           type: document
   *           documentType: pdf
   *           documents:
   *             - 46
   *           createdBy: markmo@acme.com
   *           modifiedBy: markmo@acme.com
   *         text:
   *           id: 15
   *           workspaceId: 1
   *           name: Customer Notes
   *           description: Customer notes.
   *           type: document
   *           documentType: txt
   *           documents:
   *             - 37
   *           textProperty: text
   *           splitter: delimiter
   *           characters: \\n\\n
   *           createdBy: markmo@acme.com
   *           modifiedBy: markmo@acme.com
   *         featurestore:
   *           id: 1
   *           workspaceId: 1
   *           name: Driver data
   *           description: Online feature store example.
   *           type: featurestore
   *           featurestore: feast
   *           httpMethod: post
   *           utl: https://feast.acme.com/get-online-features
   *           parametersSchema: "{\"type\":\"array\",\"items\":{\"type\":\"string\",\"title\":\"Entity\",\"description\":\"Entity ID\"},\"title\":\"Request\"}"
   *           featureList: driver_hourly_stats:conv_rate,driver_hourly_stats:acc_rate,driver_hourly_stats:avg_daily_trips
   *           entity: driver_id
   *           featureService: driver_activity
   *           createdBy: markmo@acme.com
   *           modifiedBy: markmo@acme.com
   */

  /**
   * @openapi
   * tags:
   *   name: Destinations
   *   description: The Data Sources Management API
   */

  /**
   * @openapi
   * /api/workspaces/:workspaceId/destinations:
   *   get:
   *     description: List all the data sources in the given workspace.
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
   *         description: The list of data sources
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

  app.get('/api/destinations/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    const index = await destinationsService.getDestination(id);
    res.json(index);
  });

  app.get('/api/dialects', auth, (req, res, next) => {
    const dialects = sqlSourceService.getDialects();
    res.json(dialects);
  });

  app.post('/api/destinations', auth, async (req, res, next) => {
    const { username } = req.user;
    const values = req.body;
    const destination = await destinationsService.upsertDestination(values, username);
    res.json(destination);
  });

  app.put('/api/destinations/:id', auth, async (req, res, next) => {
    const { id } = req.params;
    const { username } = req.user;
    const values = req.body;
    const destination = await destinationsService.upsertDestination({ ...values, id }, username);
    res.json(destination);
  });

  app.delete('/api/destinations/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    await destinationsService.deleteDestinations([id]);
    res.json(id);
  });

  app.delete('/api/destinations', auth, async (req, res, next) => {
    const ids = req.query.ids.split(',');
    await destinationsService.deleteDestinations(ids);
    res.json(ids);
  });

};
