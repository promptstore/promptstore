export default async ({ constants, logger, services }) => {

  const { SEARCH_INDEX_NAME, SEARCH_NODE_LABEL, SEARCH_VECTORSTORE_PROVIDER } = constants;

  const { indexesService, vectorStoreService } = services;

  const searchSchema = {
    "$id": "https://promptstore.dev/object.schema.json",
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "properties": {
      "id": {
        "type": "string",
        "description": "A unique identifier"
      },
      "nodeLabel": {
        "type": "string",
        "description": "The node label"
      },
      "label": {
        "type": "string",
        "description": "The object label, e.g., \"Prompt Template\", \"Semantic Function\", \"Data Source\""
      },
      "type": {
        "type": "string",
        "description": "The object type, e.g., \"prompt-sets\", \"functions\", \"data-sources\""
      },
      "name": {
        "type": "string",
        "description": "The object name"
      },
      "key": {
        "type": "string",
        "description": "The object key"
      },
      "text": {
        "type": "string",
        "description": "The object content to search"
      },
      "workspaceId": {
        "type": "string",
        "description": "The workspace id"
      },
      "isPublic": {
        "type": "boolean",
        "description": "Is the object visible to all?"
      },
      "metadata": {
        "type": "object",
        "description": "Additional data fields that are indexed to support hybrid or faceted search"
      },
      "createdDatetime": {
        "type": "string",
        "format": "date",
        "description": "The date-time the object was created in ISO 8601 date format"
      },
      "createdBy": {
        "type": "string",
        "description": "The username of the user who created the object"
      }
    },
    "required": [
      "id",
      "nodeLabel",
      "label",
      "type",
      "name",
      "text",
      "workspaceId",
    ]
  };

  let index = await indexesService.getIndexByName(1, SEARCH_INDEX_NAME);
  if (!index) {
    index = await indexesService.upsertIndex({
      name: SEARCH_INDEX_NAME,
      schema: searchSchema,
      workspaceId: 1,
      embeddingProvider: 'sentenceencoder',
      vectorStoreProvider: 'redis',
      nodeLabel: SEARCH_NODE_LABEL,
    }, 'system');
    logger.debug("Created new index '%s' [%s]", SEARCH_INDEX_NAME, index.id);
  }

  // await vectorStoreService.dropIndex(SEARCH_VECTORSTORE_PROVIDER, SEARCH_INDEX_NAME);
  const searchIndex = await vectorStoreService.getIndex(SEARCH_VECTORSTORE_PROVIDER, SEARCH_INDEX_NAME);
  if (!searchIndex) {
    await vectorStoreService.createIndex(SEARCH_VECTORSTORE_PROVIDER, SEARCH_INDEX_NAME, searchSchema, {
      nodeLabel: SEARCH_NODE_LABEL,
      // vectorField: 'text',
    });
  }

}