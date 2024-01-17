
import isObject from 'lodash.isobject';
import uuid from 'uuid';

import { getTextStats } from '../../../utils';

function CrawlerService({ __name, constants, logger }) {

  async function getChunks(documents, params) {
    const {
      nodeLabel = 'Chunk',
      chunkElement,
    } = params;
    const chunks = [];
    const createdDateTime = new Date().toISOString();
    for (const doc of documents) {
      if (chunkElement) {
        const elements = getElements(chunkElement, doc.content);
        for (const { text, data } of elements) {
          const chunk = getChunk(nodeLabel, doc, createdDateTime, text, data);
          chunks.push(chunk);
        }
      } else {
        const text = getText(doc.content);
        const chunk = getChunk(nodeLabel, doc, createdDateTime, text, doc.content);
        chunks.push(chunk);
      }
    }
    return chunks;
  }

  function getChunk(nodeLabel, doc, createdDateTime, text, data) {
    const { wordCount, length, size } = getTextStats(text);
    return {
      id: uuid.v4(),
      nodeLabel,
      type: 'web',
      documentId: doc.id,
      text,
      data,
      imageURI: null,
      metadata: {
        author: null,
        mimetype: doc.mimetype,
        objectName: null,
        endpoint: doc.endpoint,
        database: null,
        title: doc.title,
        subtype: null,
        parentIds: [],
        page: null,
        row: i + 1,
        wordCount,
        length,
        size,
      },
      createdDateTime,
      createdBy: 'promptstore',
      startDateTime: createdDateTime,
      endDateTime: null,
      version: 1,
    };
  }

  function getText(content) {

    function inner(_content, inline) {
      if (_content) {
        if (Array.isArray(_content)) {
          const texts = _content.map(c => inner(c, true)).filter(x => x);
          if (inline) {
            return `[${texts.join(', ')}]`;
          }
          return '- ' + texts.join('\n- ');
        }
        if (isObject(_content)) {
          const texts = [];
          for (const [el, data] of Object.entries(_content)) {
            const text = inner(data, true);
            if (text) {
              texts.push(`${el}: """${text}"""`);
            }
          }
          if (inline) {
            return `{ ${texts.join(', ')} }`;
          }
          return texts.join('\n');
        }
        if (typeof _content === 'string') {
          return _content;
        }
        return '';
      }
    }

    return inner(content);
  }

  function getElements(chunkElement, content) {

    function inner(_content) {
      if (Array.isArray(_content)) {
        return _content.map(inner);
      }
      if (isObject(_content)) {
        for (const [el, data] of Object.entries(_content)) {
          if (el === chunkElement) {
            const text = getText(data);
            return [{ text, data }];
          }
          const els = inner(data);
          if (els.length) {
            return els;
          }
        }
        return [];
      }
      return [];
    }

    return inner(content).flat(Infinity);
  }

  function getChunkSchema(chunkElement, crawlerSpec) {

    function inner(schema) {
      if (schema.type === 'array') {
        return inner(schema.items);
      }
      if (schema.type === 'object') {
        for (const [el, schem] of Object.entries(schema.properties)) {
          if (el === chunkElement) {
            return schem;
          }
          const s = inner(schem);
          if (s) {
            return s;
          }
        }
        return null;
      }
      return null;
    }

    return inner(crawlerSpec);
  }

  async function getSchema({ chunkElement, crawlerSpec }) {
    const schema = {
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
            "objectName": {
              "type": "string",
              "description": "The document object name"
            },
            "endpoint": {
              "type": "string",
              "description": "The API endpoint"
            },
            "title": {
              "type": "string",
              "description": "The document title"
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
    let properties;
    if (chunkElement) {
      const schem = getChunkSchema(chunkElement, crawlerSpec);
      if (schem) {
        properties = schem.properties;
      } else {
        logger.warn("schema not found given chunk element: '%s'", chunkElement);
      }
    } else if (crawlerSpec.type === 'object') {
      properties = crawlerSpec.properties;
    } else if (crawlerSpec.type === 'array' && crawlerSpec.items.type === 'object') {
      properties = crawlerSpec.items.properties;
    }
    if (properties) {
      schema.properties.data = {
        "type": {},
        "description": "Additional data fields that are indexed to support hybrid or faceted search",
        "properties": properties
      };
    }
    return schema;
  }

  return {
    __name,
    getChunks,
    getSchema,
  };
}

export default CrawlerService;
