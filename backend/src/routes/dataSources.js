import path from 'path';

import searchFunctions from '../searchFunctions';

export default ({ app, auth, constants, logger, pg, services }) => {

  const OBJECT_TYPE = 'data-sources';

  const {
    appsService,
    dataSourcesService,
    documentsService,
    extractorService,
    sqlSourceService,
  } = services;

  const { deleteObjects, deleteObject, indexObject } = searchFunctions({ constants, logger, services });

  /**
   * @openapi
   * components:
   *   schemas:
   *     DataSource:
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
   *     DataSourceInput:
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
   * 
   *     Dialect:
   *       type: object
   *       required:
   *         - key
   *         - name
   *       properties:
   *         key:
   *           type: string
   *           description: The plugin key of the supported database
   *         name:
   *           type: string
   *           description: The plugin name of the supported database
   */

  /**
   * @openapi
   * tags:
   *   name: DataSources
   *   description: The Data Sources Management API
   */

  /**
   * @openapi
   * /api/workspaces/{workspaceId}/data-sources:
   *   get:
   *     description: List all the data sources in the given workspace.
   *     tags: [DataSources]
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
   *                 $ref: '#/components/schemas/DataSource'
   *       500:
   *         description: Error
   */
  app.get('/api/workspaces/:workspaceId/data-sources', auth, async (req, res, next) => {
    const { workspaceId } = req.params;
    const { type } = req.query;
    let dataSources;
    if (type) {
      dataSources = await dataSourcesService.getDataSourcesByType(workspaceId, type);
    } else {
      dataSources = await dataSourcesService.getDataSources(workspaceId);
    }
    res.json(dataSources);
  });

  /**
   * @openapi
   * /api/data-sources/{id}:
   *   get:
   *     description: Lookup a data source by id.
   *     tags: [DataSources]
   *     produces:
   *       application/json
   *     parameters:
   *       - name: id
   *         description: The data source id
   *         in: path
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: The data source
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/DataSource'
   *       500:
   *         description: Error
   */
  app.get('/api/data-sources/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    const dataSource = await dataSourcesService.getDataSource(id);
    let schema;
    if (dataSource.type === 'sql') {
      schema = await sqlSourceService.getSchema(dataSource);
      logger.debug('schema:', schema);
    }
    res.json({ ...dataSource, schema });
  });

  /**
   * @openapi
   * /api/data-sources/{id}/content:
   *   get:
   *     description: Return the data of a data source. The data may be the text content or a sample of rows from a database.
   *     tags: [DataSources]
   *     produces:
   *       application/json
   *     parameters:
   *       - name: id
   *         description: The data source id
   *         in: path
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: The data source content
   *         content:
   *           text/plain:
   *             schema:
   *               type: string
   *       500:
   *         description: Error
   */
  app.get('/api/data-sources/:id/content', auth, (req, res) => {
    let mb = +req.query.maxBytes;
    if (isNaN(mb)) mb = 1000 * 1024;
    pg.query(
      'SELECT type, val FROM data_sources WHERE id = $1',
      [req.params.id],
      async (e, resp) => {
        if (e) {
          logger.error(e);
          return res.sendStatus(500);
        }
        const { type, val } = resp.rows[0];
        const source = { ...val, type };
        logger.debug('source:', source);
        if (source.type === 'document') {
          const {
            documentId,
            documentType,
            delimiter = ',',
            quoteChar = '"',
          } = source;
          pg.query(
            'SELECT workspace_id, filename FROM file_uploads WHERE id = $1',
            [documentId],
            async (e, resp) => {
              if (e) {
                logger.error(e);
                return res.sendStatus(500);
              }
              const upload = resp.rows[0];
              const objectName = path.join(String(upload.workspace_id), constants.DOCUMENTS_PREFIX, upload.filename);

              if (documentType === 'csv') {
                const content = await documentsService.read(objectName, mb);
                const options = {
                  bom: true,
                  columns: true,
                  delimiter,
                  quote: quoteChar,
                  skip_records_with_error: true,
                  trim: true,
                };
                const output = await extractorService.getChunks(
                  'csv',
                  [{ content, ext: 'csv' }],
                  { options, raw: true }
                );
                res.json(output);

              } else {
                const text = await documentsService.read(objectName, mb);
                res.json(text);
              }
            }
          );
        } else if (source.type === 'sql') {
          const sample = await sqlSourceService.getData(source, 10);
          res.json(sample);
        }
      }
    );
  });

  /**
   * @openapi
   * /api/data-sources:
   *   get:
   *     description: Return a list of supported database dialects
   *     tags: [DataSources]
   *     responses:
   *       200:
   *         description: The list of supported database dialects
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Dialect'
   *       500:
   *         description: Error
   */
  app.get('/api/dialects', auth, (req, res, next) => {
    const dialects = sqlSourceService.getDialects();
    res.json(dialects);
  });

  /**
   * @openapi
   * /api/data-sources:
   *   post:
   *     description: Create a new data source.
   *     tags: [DataSources]
   *     requestBody:
   *       description: The new source values
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/DataSourceInput'
   *     responses:
   *       200:
   *         description: The new data source
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/DataSource'
   *       500:
   *         description: Error
   */
  app.post('/api/data-sources', auth, async (req, res, next) => {
    const { username } = req.user;
    const { appId, uploadId, values } = req.body;
    let dataSource = await dataSourcesService.upsertDataSource(values, username);
    if (appId) {
      const app = appsService.getApp(appId);
      await appsService.upsertApp({
        id: appId,
        documents: {
          [uploadId]: {
            dataSource: dataSource.id,
          },
        },
      });
    }
    const obj = createSearchableObject(dataSource);
    const chunkId = await indexObject(obj, dataSource.chunkId);
    if (!dataSource.chunkId) {
      dataSource = await dataSourcesService.upsertDataSource({ ...dataSource, chunkId }, username);
    }
    res.json(dataSource);
  });

  /**
   * @openapi
   * /api/data-sources/{id}:
   *   put:
   *     description: Update a data source.
   *     tags: [DataSources]
   *     parameters:
   *       - name: id
   *         description: The data source id
   *         in: path
   *         schema:
   *           type: integer
   *     requestBody:
   *       description: The updated source values
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/DataSourceInput'
   *     responses:
   *       200:
   *         description: The updated data source
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/DataSource'
   *       500:
   *         description: Error
   */
  app.put('/api/data-sources/:id', auth, async (req, res, next) => {
    const { id } = req.params;
    const { username } = req.user;
    const values = req.body;
    let dataSource = await dataSourcesService.upsertDataSource({ ...values, id }, username);
    const obj = createSearchableObject(dataSource);
    const chunkId = await indexObject(obj, dataSource.chunkId);
    if (!dataSource.chunkId) {
      dataSource = await dataSourcesService.upsertDataSource({ ...dataSource, chunkId }, username);
    }
    res.json(dataSource);
  });

  /**
   * @openapi
   * /api/data-sources/{id}:
   *   delete:
   *     description: Delete a data source.
   *     tags: [DataSources]
   *     parameters:
   *       - name: id
   *         description: The data source id
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
  app.delete('/api/data-sources/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    await dataSourcesService.deleteDataSources([id]);
    await deleteObject(objectId(id));
    res.json(id);
  });

  /**
   * @openapi
   * /api/data-sources:
   *   delete:
   *     description: Delete multiple data sources
   *     tags: [DataSources]
   *     parameters:
   *       - name: ids
   *         description: A comma separated list of ids
   *         in: query
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: The deleted data source ids
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: string
   *       500:
   *         description: Error
   */
  app.delete('/api/data-sources', auth, async (req, res, next) => {
    const ids = req.query.ids.split(',');
    await dataSourcesService.deleteDataSources(ids);
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
      label: 'Data Source',
      type: OBJECT_TYPE,
      name: rec.name,
      text,
      createdDateTime: rec.created,
      createdBy: rec.createdBy,
      workspaceId: String(rec.workspaceId),
      metadata: {
        documentType: rec.documentType,
      },
    };
  }

};
