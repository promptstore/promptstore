import fs from 'fs';
import omit from 'lodash.omit';
import path from 'path';
import sizeOf from 'image-size';
import uuid from 'uuid';
import startCase from 'lodash.startcase';
import camelCase from 'lodash.camelcase';
import { default as dayjs } from 'dayjs';
import { UMAP } from 'umap-js';

import { getDestinationSchema } from '../core/conversions/schema';
import { EmbeddingProvider } from '../core/indexers/EmbeddingProvider';
import { GraphStore } from '../core/indexers/GraphStore';
import { Indexer } from '../core/indexers/Indexer';
import { Pipeline } from '../core/indexers/Pipeline';
import { getTextStats } from '../utils';

const supportedMimetypes = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-outlook',
  'application/octet-stream',
  'message/rfc822',
  'text/html',
  'application/json',
  'application/epub+zip',
  'application/vnd.oasis.opendocument.text',
  'application/rtf',
  'text/plain',
  'application/xml',
  'text/xml',
];

const imageMimetypes = [
  'image/png',
  'image/jpeg',
];

export const createActivities = ({
  mc,
  logger,
  callLoggingService,
  dataSourcesService,
  destinationsService,
  evaluationsService,
  executionsService,
  extractorService,
  functionsService,
  graphStoreService,
  indexesService,
  llmService,
  loaderService,
  modelsService,
  secretsService,
  sqlSourceService,
  uploadsService,
  vectorStoreService,
}) => ({

  async evaluate(evaluation, workspaceId, username) {
    const filter = {};
    const { id, model, completionFunction, dateRange, criteria } = evaluation;
    if (model) {
      filter.model = model;
    }
    if (completionFunction) {
      filter.function_id = completionFunction;
    }
    if (dateRange?.length === 2) {
      logger.debug('date range:', dateRange);
      if (dateRange[0]) {
        filter['start_date[>=]'] = dateRange[0];
        if (dateRange[1]) {
          const endDate = dayjs(dateRange[1]).add(1, 'day').format('YYYY-MM-DD');
          filter['start_date[<=]'] = endDate;
        }
      }
    }
    const limit = evaluation.sampleSize;
    const logs = await callLoggingService.getCallLogs(workspaceId, filter, limit, 0);
    logger.debug('logs:', logs);
    const args = logs.map(log => ({
      input: log.modelUserInputText,
      completion: log.systemOutputText,
      criteria,
    }));

    const texts = logs.map(log => log.systemOutputText);
    const embeddingModel = { provider: 'openai', model: 'text-embedding-ada-002' };
    const embedder = EmbeddingProvider.create(embeddingModel, llmService);
    const res = await embedder.createEmbeddings(texts, 1024);
    const embeddings = res.data.map(e => e.embedding);
    const umap = new UMAP({ nComponents: 2, nNeighbors: 5 });
    const embedding = umap.fit(embeddings);
    logger.debug('umap embedding:', embedding);

    const outputFormatter = {
      name: 'output_formatter',
      description: 'Output as JSON. Should always be used to format your response to the user.',
      parameters: {
        type: 'object',
        properties: {
          results: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: {
                  type: 'integer',
                  desciption: 'unique index of result',
                },
                evaluation_result: {
                  description: 'evaluation result',
                  type: 'string',
                },
              }
            }
          }
        },
        required: ['results'],
      },
    };
    const functions = [outputFormatter];
    const extraSystemPrompt = `Process each of the provided text items and return the results as a JSON list of objects using the output_formatter.`;
    const func = await functionsService.getFunctionByName(workspaceId, 'closed_qa_eval_batch');
    logger.debug('args:', args);
    const { errors, response } = await executionsService.executeFunction({
      workspaceId,
      username,
      batch: true,
      func,
      args,
      extraSystemPrompt,
      params: { maxTokens: 512 },
      functions,
      options: { batchResultKey: 'evaluation_result', contentProp: '__all' },
    });
    if (errors) {
      logger.error('Error calling function "%s":', func.name, errors);
      return { errors };
    }
    const serializedJson = response.choices[0].message.function_call.arguments;
    const json = JSON.parse(serializedJson);
    logger.debug('json:', json);
    const failed = [];
    const proms = [];
    for (let i = 0; i < json.length; i++) {
      const evaluation = {
        evaluationId: id,
        criteria,
        result: json[i],
      };
      const log = logs[i];
      const logId = log.id;
      if (json[i] === 'N') {
        failed.push({
          ...evaluation,
          logId,
          input: log.modelUserInputText,
          completion: log.systemOutputText,
        });
      }
      const evaluations = [evaluation];
      proms.push(callLoggingService.updateCallLog(logId, { evaluations }));
    }
    const updatedLogs = await Promise.all(proms);
    const run = {
      runDate: new Date(),
      logIds: logs.map(l => l.id),
      failed,
      allTestsPassed: !failed.length,
      numberTests: logs.length,
      numberFailed: failed.length,
      percentPassed: (logs.length - failed.length) / logs.length,
      embedding,
    };
    const updatedEvaluation = await evaluationsService.upsertEvaluation(({
      ...evaluation,
      runs: [...(evaluation.runs || []), run],
    }));
    logger.debug('updated evaluation:', updatedEvaluation);

    return updatedEvaluation;
  },

  executeComposition(params) {
    return executionsService.executeComposition(params);
  },

  async index(params, loaderProvider, extractorProviders) {
    try {
      const pipeline = new Pipeline({
        executionsService,
        extractorService,
        functionsService,
        graphStoreService,
        indexesService,
        llmService,
        loaderService,
        vectorStoreService,
      }, {
        loaderProvider,
        extractorProviders,
      });
      const index = await pipeline.run(params);
      return index;
    } catch (err) {
      logger.error(err);
      throw err;
    }
  },

  logCall(params) {
    try {
      callLoggingService.createCallLog(params);
    } catch (err) {
      logger.error(err);
      throw err;
    }
  },

  async transform(transformation, workspaceId, username) {
    // logger.info('transformation:', transformation);
    // logger.info('workspaceId:', workspaceId);
    // logger.info('username:', username);
    const dataSource = await dataSourcesService.getDataSource(transformation.dataSourceId);
    const source = await secretsService.interpolateSecretsInObject(workspaceId, dataSource, ['connectionString']);
    const all = transformation.features.some(f => f.column === '__all');
    let cols;
    if (!all) {
      cols = transformation.features.map(f => f.column);
    }
    const columns = await sqlSourceService.getDataColumns(source, 25, cols);
    const features = transformation.features || [];
    logger.debug('features:', features);
    const featureNames = [];
    const result = {};
    const cleanedFeatures = [];
    const textNodeProperties = [];
    for (const feature of features) {
      let func;
      if (feature.functionId !== '__pass') {
        func = await functionsService.getFunction(feature.functionId);
        if (!func) {
          throw new Error('Function not found:', feature.functionId);
        }
      }
      let featureName;
      if (feature.name) {
        featureName = feature.name;
      } else if (feature.functionId !== '__pass') {
        featureName = func.name;
      } else if (feature.column !== '__all') {
        featureName = feature.column;
      }
      logger.debug('featureName:', featureName);
      cleanedFeatures.push({ name: featureName, dataType: feature.type, mandatory: false });
      featureNames.push(featureName);
      if (feature.dataType === 'Vector') {
        textNodeProperties.push(featureName);
      }
      if (feature.functionId === '__pass') {
        if (feature.column === '__all') {
          for (const key of Object.keys(columns)) {
            result[key] = columns[key];
          }
          continue;
        }
        result[featureName] = columns[feature.column];
        continue;
      }
      result[featureName] = [];
      logger.debug('func:', func?.name);
      if (func) {
        let text;
        if (feature.column === '__all') {
          // TODO with or without structure
          const values = Object.values(columns);
          if (values.length) {
            text = values[0].map(stringify);
          }
          for (const vals of values.slice(1)) {
            text = text.map((t, i) => {
              const t1 = stringify(vals[i]);
              if (t1) {
                return t + ' ' + t1;
              }
              return t;
            });
          }
        } else {
          text = columns[feature.column];
        }
        if (text) {
          const args = { text };
          const outputFormatter = {
            name: 'output_formatter',
            description: 'Output as JSON. Should always be used to format your response to the user.',
            parameters: {
              type: 'object',
              properties: {
                results: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: {
                        type: 'integer',
                        desciption: 'unique index of result',
                      },
                      [featureName]: {
                        description: feature.description,
                        type: getDestinationType(feature.dataType),
                      },
                    }
                  }
                }
              },
              required: ['results'],
            },
          };
          const functions = [outputFormatter];
          const extraSystemPrompt = `Process each of the provided text items and return the results as a JSON list of objects using the output_formatter.`;
          logger.debug('args:', args);
          const { errors, response } = await executionsService.executeFunction({
            workspaceId,
            username,
            batch: true,
            func,
            args,
            extraSystemPrompt,
            params: {},
            functions,
            options: { batchResultKey: featureName },
            // options: { batchResultKey: featureName, contentProp: '__all' },  // TODO - trial to standardise batch handling
          });
          if (errors) {
            logger.error('Error calling function "%s":', func.name, errors);
            continue;
          }
          const serializedJson = response.choices[0].message.function_call.arguments;
          const json = JSON.parse(serializedJson);
          result[featureName] = json;
        }
      }
    }
    // logger.debug('result:', result);
    const rows = convertColumnsToRows(featureNames, result);
    // logger.debug('rows:', rows);

    const schema = getDestinationSchema(cleanedFeatures);
    if (transformation.destinationIds?.length) {
      for (const destinationId of transformation.destinationIds) {
        const destination = await destinationsService.getDestination(destinationId);
        if (destination) {
          await sqlSourceService.createTable(destination, rows, schema, source.connectionString);
        }
      }
    }
    if (transformation.indexId || transformation.graphStoreProvider) {
      // logger.debug('textNodeProperties:', textNodeProperties);
      const nodeLabel = startCase(camelCase(transformation.name));
      const indexSchema = getSchema({ jsonSchema: schema, textNodeProperties });
      const props = indexSchema.properties.data.properties;
      const chunks = rows.map((data, i) => createChunk(data, i, props, nodeLabel, textNodeProperties));
      if (transformation.indexId) {
        const indexer = new Indexer({
          indexesService: indexesService,
          llmService: llmService,
          vectorStoreService: vectorStoreService,
        });
        const model = await modelsService.getModelByKey(workspaceId, transformation.embeddingModel);
        const embeddingModel = {
          provider: model.provider,
          model: model.key,
        };
        // also looks up the index
        await indexer.index(chunks, {
          indexId: transformation.indexId,
          nodeLabel,
          schema: indexSchema,
          embeddingModel,
          vectorStoreProvider: transformation.vectorStoreProvider,
        });
      }
      if (transformation.graphStoreProvider) {
        const graphStore = GraphStore.create(transformation.graphStoreProvider, nodeLabel, {
          executionsService,
          graphStoreService,
        });
        graphStore.addChunksWithoutExtraction(chunks);
      }
    }

    return { status: 'OK' };
  },

  upload(file, workspaceId, appId, username, constants) {
    logger.info('file:', file);
    logger.info('workspace id:', workspaceId);
    logger.info('app id:', appId);
    logger.info('username:', username);
    logger.info('constants:', constants);
    const metadata = {
      filename: file.originalname,
      'Content-Type': file.mimetype,
    };
    let objectName;
    if (appId) {
      objectName = path.join(
        String(workspaceId),
        constants.DOCUMENTS_PREFIX,
        'apps',
        String(appId),
        file.originalname
      );
    } else {
      objectName = path.join(
        String(workspaceId),
        constants.DOCUMENTS_PREFIX,
        file.originalname
      );
    }
    logger.debug('objectName:', objectName);
    if (!fs.existsSync(file.path)) {
      return Promise.reject(new Error('File no longer on path: ' + file.path));
    }
    return new Promise((resolve, reject) => {
      mc.fPutObject(constants.FILE_BUCKET, objectName, file.path, metadata, async (err) => {
        if (err) {
          logger.error(err, err.stack);
          return reject(err);
        }
        logger.info('File uploaded successfully.');

        let data;
        logger.debug('mimetype:', file.mimetype);
        if (supportedMimetypes.includes(file.mimetype)) {
          if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
            logger.debug('using onesource');
            data = await extractorService.extract('onesource', file.path, file.originalname, file.mimetype);
          } else {
            logger.debug('using unstructured');
            data = await extractorService.extract('unstructured', file.path, file.originalname, file.mimetype);
          }
        }
        let width, height;
        if (imageMimetypes.includes(file.mimetype)) {
          const dims = sizeOf(file.path);
          width = dims.width;
          height = dims.height;
        }

        try {
          const upload = await uploadsService.getUploadByFilename(file.originalname);
          const uploadRecord = {
            id: upload?.id,
            workspaceId,
            filename: file.originalname,
            data,
            appId,
            private: !!appId,
            width,
            height,
          };
          const uploaded = await uploadsService.upsertUpload(uploadRecord, username);
          logger.info('uploaded', uploaded);

          mc.statObject(constants.FILE_BUCKET, objectName, (err, stat) => {
            if (err) {
              logger.error(err, err.stack);
              return reject(err);
            }
            const record = omit(uploaded, ['data']);
            resolve({
              ...record,
              etag: stat.etag,
              size: stat.size,
              lastModified: stat.lastModified,
              name: objectName,
            });
          });

        } catch (err) {
          logger.error(err, err.stack);
          reject(err);
        }
      });
    });
  },

  async reload(file, workspaceId, username, uploadId) {
    let data;
    if (supportedMimetypes.includes(file.mimetype)) {
      if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        data = await extractorService.extract('onesource', file.path, file.originalname, file.mimetype);
      } else {
        data = await extractorService.extract('unstructured', file.path, file.originalname, file.mimetype);
      }
    }

    if (data) {
      try {
        const uploadRecord = {
          id: uploadId,
          workspaceId,
          filename: file.originalname,
          data,
        };
        const res = await uploadsService.upsertUpload(uploadRecord, username);
        logger.info('Updated', res);
        return 'OK';

      } catch (err) {
        logger.error(String(err));
        throw err;
      }
    } else {
      logger.info('No data');
    }
  },

});

function convertColumnsToRows(features, result) {
  const rows = [];
  const n = result[features[0]].length;
  for (let i = 0; i < n; i++) {
    const row = features.reduce((a, col) => {
      a[col] = result[col][i];
      return a;
    }, {});
    rows.push(row);
  }
  return rows;
}

const allowedTypes = ['string', 'number', 'boolean'];

function createChunk(data, i, props, nodeLabel, textNodeProperties) {
  let text;
  if (textNodeProperties.length) {
    text = Object.entries(data)
      .filter(([k, v]) => textNodeProperties.includes(k) && v)
      .map(([k, v]) => v)
      .join('\n')
      ;
  } else {
    text = Object.entries(data)
      .map(([k, v]) => {
        if (props[k].type === 'string') {
          return k + ': ' + v;
        }
        return '';
      })
      .filter(([k, v]) => v)
      .join('\n')
      ;
  }
  const { wordCount, length, size } = getTextStats(text);
  const createdDateTime = new Date().toISOString();
  return {
    id: uuid.v4(),
    nodeLabel,
    type: 'record',
    documentId: null,
    text,
    imageURI: null,
    data,
    metadata: {
      author: null,
      mimetype: null,
      objectName: null,
      endpoint: null,
      database: null,
      subtype: null,
      parentIds: [],
      page: null,
      row: i + 1,
      wordCount,
      length,
      size,
    },
    createdDateTime,
    createdBy: 'transformation-job',
    startDateTime: createdDateTime,
    endDateTime: null,
    version: 1,
  };
}

function getDestinationType(dataType) {
  switch (dataType) {
    case 'String':
    case 'Vector':
      return 'string';

    case 'Integer':
    case 'Float':
      return 'number';

    case 'Boolean':
      return 'boolean';

    default:
      return 'string';
  }
}

function getSchema({ jsonSchema, textNodeProperties }) {
  const props = Object.entries(jsonSchema.properties).reduce((a, [k, v]) => {
    const isTag = (
      v.type === 'string' &&
      textNodeProperties &&
      !textNodeProperties.includes(k)
    );
    if (allowedTypes.includes(v.type)) {
      a[k] = {
        type: v.type,
        description: v.description,
        tag: isTag,
      };
    }
    return a;
  }, {});

  return {
    "$id": "https://promptstore.dev/chunk.schema.json",
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "title": "Chunk",
    "type": "object",
    "properties": {
      "id": {
        "type": "string",
        "description": "A unique identifier"
      },
      "nodeLabel": {
        "type": "string",
        "description": "The node type that will be used in a graph representation, e.g., \"Chunk\". Also equates to an \"Entity\" in a Feature Store."
      },
      "documentId": {
        "type": "string",
        "description": "The id of the source document"
      },
      "type": {
        "type": "string",
        "description": "The type of chunk if defined, e.g., \"Title\", \"NarrativeText\", \"Image\""
      },
      "text": {
        "type": "string",
        "description": "The chunk text"
      },
      "data": {
        "type": {},
        "description": "Additional data fields that are indexed to support hybrid or faceted search",
        "properties": props
      },
      "metadata": {
        "type": "object",
        "properties": {
          "author": {
            "type": "string",
            "description": "The document author"
          },
          "mimetype": {
            "type": "string",
            "description": "The document MIME (Multipurpose Internet Mail Extension) type"
          },
          "dataSourceId": {
            "type": "string",
            "description": "The data source id"
          },
          "dataSourceName": {
            "type": "string",
            "description": "The data source name"
          },
          "uploadId": {
            "type": "string",
            "description": "The upload id"
          },
          "filename": {
            "type": "string",
            "description": "The file name"
          },
          "objectName": {
            "type": "string",
            "description": "The document object name"
          },
          "endpoint": {
            "type": "string",
            "description": "The API endpoint"
          },
          "database": {
            "type": "string",
            "description": "The database name"
          },
          "subtype": {
            "type": "string",
            "description": "The chunk subtype if defined"
          },
          "parentIds": {
            "type": "array",
            "description": "A list of parent chunks that this chunk belongs to. (There may be multiple to link to all parent chunks in the hierarchy as a convenience.)",
            "items": {
              "type": "string"
            }
          },
          "page": {
            "type": "number",
            "description": "The page number in the source document where this chunk is found"
          },
          "row": {
            "type": "number",
            "description": "The row number in the source document where this chunk is found"
          },
          "wordCount": {
            "type": "number",
            "description": "The word count of text in this chunk"
          },
          "length": {
            "type": "number",
            "description": "The character length of the trimmed text in this chunk"
          },
          "size": {
            "type": "number",
            "description": "The size in bytes of the trimmed text in this chunk"
          }
        }
      },
      "createdDatetime": {
        "type": "string",
        "description": "The timestamp in ISO format when this chunk was created"
      },
      "createdBy": {
        "type": "string",
        "description": "The process or system that created this chunk"
      },
      "startDatetime": {
        "type": "string",
        "description": "The timestamp in ISO format when this chunk became valid (SCD Type 2)"
      },
      "endDatetime": {
        "type": "string",
        "description": "The timestamp in ISO format when this chunk became invalid (SCD Type 2)"
      },
      "version": {
        "type": "number",
        "description": "The version number"
      }
    },
    "required": [
      "id",
      "nodeLabel",
      "documentId",
      "text",
      "metadata",
      "createdDateTime",
      "createdBy",
      "startDateTime",
      "endDateTime",
      "version"
    ]
  };
}

const stringify = (val) => {
  if (val === null || typeof val === 'undefined') {
    return '';
  }
  return String(val);
};