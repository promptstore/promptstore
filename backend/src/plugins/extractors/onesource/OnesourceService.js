import FormData from 'form-data';
import axios from 'axios';
import fs from 'fs';
import uuid from 'uuid';

import { getTextStats } from '../../../utils';

function OnesourceService({ __name, constants, logger }) {

  const allowedExtensions = ['docx', 'pdf'];

  async function getChunks(documents, {
    nodeLabel = 'Chunk',
    filepath,
    originalname,
    mimetype,
  }) {
    const { data, metadata } = await extract(filepath, originalname, mimetype);
    const createdDateTime = new Date().toISOString();
    return data.structured_content.map((el) => {
      let text;
      if (el.type === 'list') {
        text = el.heading + '\n' + el.items.map((it) => '- ' + it).join('\n');
      } else {
        text = el.text;
      }
      const { wordCount, length, size } = getTextStats(text);
      return {
        id: uuid.v4(),
        nodeLabel,
        type: el.type,
        documentId: null,
        text,
        imageURI: null,
        data: {},
        metadata: {
          author: metadata.author,
          mimetype: getMimeType(metadata.doc_type),
          objectName: metadata.record_id,
          endpoint: null,
          database: null,
          subtype: el.subtype,
          parentIds: [],
          page: el.metadata.page_number,
          row: null,
          wordCount,
          length,
          size,
        },
        createdDateTime: metadata.created_date || createdDateTime,
        createdBy: constants.CREATED_BY,
        startDateTime: metadata.created_date || createdDateTime,
        endDateTime: null,
        version: 1,
      };
    });
  }

  function getSchema() {
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
        // "data": {
        //   "type": "array",
        //   "description": "Additional data fields that are indexed to support hybrid or faceted search",
        //   "items": {
        //     "type": "object",
        //     "properties": {
        //       "key": {
        //         "type": "string",
        //         "description": "The field name"
        //       },
        //       "value": {
        //         "type": {},
        //         "description": "The field value"
        //       },
        //       "type": {
        //         "type": "string",
        //         "description": "The value type"
        //       },
        //       "subtype": {
        //         "type": "string",
        //         "description": "The value subtype, e.g., \"Tag\""
        //       }
        //     }
        //   }
        // },
        "data": {
          "type": {},
          "description": "Additional data fields that are indexed to support hybrid or faceted search"
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

  /**
   * Original output format:
   * 
   * {
   *   "metadata": {
   *     "doc_type": "PDF",
   *     "record_id": "<filename, no ext>"
   *     "created_date": "",
   *     "last_mod_date": "",
   *     "author": "",
   *     "word_count": -1
   *   },
   *   "data": {
   *     "text": [<array of text>],
   *     "structured_content": [
   *       {
   *         "type": "heading|text|...",
   *         "text": ""
   *       }
   *     ]
   *   }
   * }
   * 
   * @param {*} file 
   * @returns 
   */
  async function extract(filepath, originalname, mimetype) {
    try {
      const data = await fs.promises.readFile(filepath);
      const form = new FormData();
      form.append('file', data, {
        filename: originalname,
        contentType: mimetype,
      });
      const res = await axios.post(constants.ONESOURCE_API_URL, form, {
        headers: form.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });
      logger.debug('File uploaded to document service successfully.');
      logger.debug('res: ', res.data);
      return res.data;
    } catch (err) {
      logger.log('error', String(err), err.stack);
    }
  }

  function getMimeType(doctype) {
    switch (doctype) {
      case 'PDF':
        return 'application/pdf';

      case 'Word':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

      default:
        return 'text/plain';
    }
  }

  return {
    __name,
    getChunks,
    getSchema,
    matchDocument,
    extract,
  };
}

export default OnesourceService;
