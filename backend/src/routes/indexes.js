import { EmbeddingProvider } from '../core/indexers/EmbeddingProvider';

import searchFunctions from '../searchFunctions';

export default ({ app, auth, constants, logger, services }) => {

  const DEFAULT_EMBEDDING_NODE_PROPERTY = "embedding";

  const DEFAULT_NODE_LABEL = "Chunk";

  const DEFAULT_SCHEMA = {
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
        "description": "The type of chunk if defined, e.g., \"Title\", \"NarrativeText\", \"Image\"",
      },
      "text": {
        "type": "string",
        "description": "The chunk text",
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
            "description": "The file object name"
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

  const DEFAULT_SIMILARITY_METRIC = "cosine";

  const OBJECT_TYPE = 'indexes';

  const {
    graphStoreService,
    indexesService,
    llmService,
    modelsService,
    vectorStoreService,
  } = services;

  const { deleteObjects, deleteObject, indexObject } = searchFunctions({ constants, logger, services });

  app.get('/api/workspaces/:workspaceId/indexes', auth, async (req, res, next) => {
    const { workspaceId } = req.params;
    const indexes = await indexesService.getIndexes(workspaceId);
    res.json(indexes);
  });

  app.get('/api/indexes/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    const index = await indexesService.getIndex(id);
    res.json(index);
  });

  app.post('/api/indexes', auth, async (req, res, next) => {
    const { username } = req.user;
    let values = {
      ...req.body,
      nodeLabel: DEFAULT_NODE_LABEL,
      schema: DEFAULT_SCHEMA,
    };
    let embeddingModel;
    let embeddingProvider;
    let embeddingDimension;
    if (values.vectorStoreProvider && !['redis', 'elasticsearch'].includes(values.vectorStoreProvider)) {
      if (values.embeddingModel) {
        const model = await modelsService.getModelByKey(values.workspaceId, values.embeddingModel);
        if (model) {
          embeddingModel = model.key;
          embeddingProvider = model.provider;
          const embedder = EmbeddingProvider.create(
            { model: embeddingModel, provider: embeddingProvider },
            llmService,
          );
          const response = await embedder.createEmbedding({ input: 'foo', model: embeddingModel });
          embeddingDimension = response.data[0].embedding.length;
          values = {
            ...values,
            embeddingDimension,
            embeddingModel,
            embeddingNodeProperty: DEFAULT_EMBEDDING_NODE_PROPERTY,
            embeddingProvider,
            similarityMetric: DEFAULT_SIMILARITY_METRIC,
          }
        }
      }
    }
    let index = await indexesService.upsertIndex(values, username);
    logger.debug('index:', index);
    const obj = createSearchableObject(index);
    const chunkId = await indexObject(obj, index.chunkId);
    if (!index.chunkId) {
      index = await indexesService.upsertIndex({ ...index, chunkId }, username);
    }
    res.json(index);
  });

  app.put('/api/indexes/:id', auth, async (req, res, next) => {
    const { id } = req.params;
    const { username } = req.user;
    const values = req.body;
    let index = await indexesService.upsertIndex({ ...values, id }, username);
    const obj = createSearchableObject(index);
    const chunkId = await indexObject(obj, index.chunkId);
    if (!index.chunkId) {
      index = await indexesService.upsertIndex({ ...index, chunkId }, username);
    }
    res.json(index);
  });

  app.delete('/api/indexes/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    await deletePhysicalIndexAndData(id);
    await indexesService.deleteIndexes([id]);
    await deleteObject(objectId(id));
    res.json(id);
  });

  app.delete('/api/indexes', auth, async (req, res, next) => {
    const ids = req.query.ids.split(',');
    const proms = ids.map(deletePhysicalIndexAndData);
    await Promise.all(proms);
    await indexesService.deleteIndexes(ids);
    await deleteObjects(ids.map(objectId));
    res.json(ids);
  });

  async function deletePhysicalIndexAndData(indexId) {
    const { name, nodeLabel, vectorStoreProvider, graphStoreProvider } = await indexesService.getIndex(indexId);
    if (vectorStoreProvider) {
      try {
        await vectorStoreService.dropData(vectorStoreProvider, name, { nodeLabel });
        await vectorStoreService.dropIndex(vectorStoreProvider, name);
      } catch (err) {
        logger.error(`Error dropping index %s:%s:`, vectorStoreProvider, name, err);
        // maybe no such index
      }
    } else if (graphStoreProvider) {
      try {
        await graphStoreService.dropData(graphStoreProvider, name);
      } catch (err) {
        logger.error(`Error dropping data from %s:%s:`, graphStoreProvider, name, err);
        // maybe no such store
      }
    }
  }

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
      label: 'Semantic Index',
      type: OBJECT_TYPE,
      name: rec.name,
      text,
      createdDateTime: rec.created,
      createdBy: rec.createdBy,
      workspaceId: String(rec.workspaceId),
      metadata: {
        vectorStoreProvider: rec.vectorStoreProvider,
        graphStoreProvider: rec.graphStoreProvider,
      },
    };
  }

};
