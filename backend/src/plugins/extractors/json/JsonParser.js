import uuid from 'uuid';

function JsonParser({ __name, constants, logger }) {

  const allowedExtensions = ['json'];

  const allowedTypes = ['string', 'number', 'boolean'];

  function getChunks(documents, {
    jsonSchema,
    textNodeProperties,
    nodeLabel = 'Chunk',
  }) {
    const schema = getSchema({ jsonSchema, textNodeProperties });
    const props = schema.properties.data.properties;
    const createdDateTime = new Date().toISOString();
    return documents.map((doc) => {
      const text = Object.entries(doc.content)
        .map(([k, v]) => {
          if (props[k] === 'string') {
            return k + ': ' + String(value);
          }
          return '';
        })
        .filter(([k, v]) => v)
        .join('\n');
      const scalarValues = Object.entries(doc.content).reduce((a, [k, v]) => {
        if (allowedTypes.includes(v.type)) {
          a[k] = v;
        }
        return a;
      }, {});
      const { wordCount, length, size } = getTextStats(text);
      return {
        id: uuid.v4(),
        nodeLabel,
        type: 'json',
        documentId: doc.id,
        text,
        imageURI: null,
        data: scalarValues,
        metadata: {
          author: null,
          mimetype: doc.mimetype,
          objectName: null,
          endpoint: doc.endpoint,
          database: null,
          subtype: null,
          parentIds: [],
          page: null,
          row: null,
          row: null,
          wordCount,
          length,
          size,
        },
        createdDateTime,
        createdBy: constants.CREATED_BY,
        startDateTime: createdDateTime,
        endDateTime: null,
        version: 1,
      };
    });
  }

  function getSchema({ jsonSchema, textNodeProperties }) {
    // logger.debug('textNodeProperties:', textNodeProperties);
    // logger.debug('jsonSchema:', jsonSchema);

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
            "objectName": {
              "type": "string",
              "description": "The document object name"
            },
            "endpoint": {
              "type": "string",
              "description": "The API endpoint"
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

  function matchDocument(doc) {
    return allowedExtensions.inlcudes(doc.ext);
  }

  function getTextStats(text) {
    if (!text) {
      return { wordCount: 0, length: 0, size: 0 };
    }
    text = text.trim();
    if (!text.length) {
      return { wordCount: 0, length: 0, size: 0 };
    }
    const wordCount = text.split(/\s+/).length;
    const length = text.length;
    const size = new Blob([text]).size;
    return { wordCount, length, size };
  }

  return {
    __name,
    getChunks,
    getSchema,
    matchDocument,
  };
}

export default JsonParser;
