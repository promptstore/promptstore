import unescapeJs from 'unescape-js';
import uuid from 'uuid';

import { TokenTextSplitter } from '../../../core/splitters/TokenTextSplitter';
import { getTextStats } from '../../../utils';

function TextParser({ __name, constants, logger }) {

  const allowedExtensions = ['txt', 'text'];

  async function getChunks(documents, params) {
    const {
      nodeLabel = 'Chunk',
      splitter,
      characters = '\n\n',
      functionId,
      chunkSize,
      chunkOverlap,
      workspaceId,
      username,
    } = params;
    const chunks = [];
    for (const doc of documents) {
      const text = doc.content;
      let splits;
      if (splitter === 'delimiter') {
        // Needing this library to unescape `\\n\\n` back to new-line characters
        // `unescape` or `decodeURIComponent` is not working
        splits = text.split(unescapeJs(characters));

      } else if (splitter === 'token') {
        const textSplitter = new TokenTextSplitter({ chunkSize, chunkOverlap });
        splits = await textSplitter.splitText(text);

      } else if (splitter === 'chunker') {
        const func = await functionsService.getFunction(functionId);
        if (!func) {
          throw new Error('Chunker function not found');
        }
        const { response, errors } = await executionsService.executeFunction({
          workspaceId,
          username,
          semanticFunctionName: func.name,
          args: { text },
        });
        if (errors) {
          throw new Error(JSON.stringify(errors));
        }
        splits = response.chunks;

      } else {
        throw new Error('Unsupported splitter: ' + splitter);
      }

      const createdDateTime = new Date().toISOString();
      chunks.push(...splits.map((text, i) => {
        const { wordCount, length, size } = getTextStats(text);
        return {
          id: uuid.v4(),
          nodeLabel,
          type: 'text',
          documentId: doc.id,
          text,
          imageURI: null,
          metadata: {
            author: null,
            mimetype: 'text/plain',
            objectName: doc.objectName,
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
          createdBy: 'promptstore',
          startDateTime: createdDateTime,
          endDateTime: null,
          version: 1,
        };
      }));
    }
    return chunks;
  }

  async function getSchema() {
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

  return {
    __name,
    getChunks,
    getSchema,
    matchDocument,
  };
}

export default TextParser;
