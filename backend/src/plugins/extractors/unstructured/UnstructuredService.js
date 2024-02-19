import FormData from 'form-data';
import axios from 'axios';
import fs from 'fs';
import uuid from 'uuid';

import { getTextStats } from '../../../utils';

function UnstructuredService({ __name, constants, logger }) {

  const allowedExtensions = [
    'txt',
    'text',
    'epub',
    'eml',
    'xlsx',
    'html',
    'json',
    'md',
    'doc',
    'docx',
    'odt',
    'msg',
    'pdf',
    'ppt',
    'pptx',
    'rst',
    'rtf',
    'tsv',
    'xml',
  ];

  async function getChunks(documents, {
    nodeLabel = 'Chunk',
  }) {
    const chunks = [];
    let elementIdCache = {};
    for (const doc of documents) {
      logger.debug('doc:', doc);
      const content = await extract(doc.filepath, doc.originalname, doc.mimetype);
      const createdDateTime = new Date().toISOString();
      for (const el of content) {
        const text = el.text.trim();
        // `element_id` is not unique, it is a SHA256 hash id
        // if `text` is the same then `element_id` is the same
        if (text && !elementIdCache[el.element_id]) {
          const { wordCount, length, size } = getTextStats(el.text);
          const chunk = {
            id: uuid.v4(),
            nodeLabel,
            type: el.type,
            documentId: null,
            text: el.text,
            imageURI: null,
            data: {},
            metadata: {
              author: null,
              mimetype: el.metadata.filetype,
              dataSourceId: doc.dataSourceId,
              dataSourceName: doc.dataSourceName,
              uploadId: doc.uploadId,
              filename: el.metadata.filename,

              // TODO
              objectName: el.metadata.filename,

              endpoint: null,
              database: null,
              subtype: null,
              parentIds: [],  // TODO see `convertToOnesourceFormat`
              page: el.metadata.page_number,
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
          chunks.push(chunk);
          elementIdCache[el.element_id] = 1;
        }
      }
    }
    elementIdCache = null;
    return chunks;
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
   * 
   * Input format:
   * 
   * [
   *   {
   *     "type": "UncategorizedText|Title|NarrativeText",
   *     "element_id": "09fb33b69d26487f33c84385d961d0a8",
   *     "metadata": {
   *       "filetype": "application/pdf",
   *       "page_number": 1,
   *       "filename": "<filename with ext>"
   *     },
   *     "text": ""
   *   }
   * ]
   * 
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
   * @param {*} filepath 
   * @param {*} originalname 
   * @param {*} mimetype 
   * @returns 
   */
  async function extract(filepath, originalname, mimetype) {
    logger.debug('extracting file content using the unstructured api');
    try {
      if (!fs.existsSync(filepath)) {
        return Promise.reject(new Error('File no longer on path: ' + filepath));
      }
      const stats = fs.statSync(filepath);
      logger.debug('stats:', stats);
      const fileSizeInBytes = stats.size;
      const data = await fs.promises.readFile(filepath);
      const form = new FormData();
      // must be `files` (plural) not `file`
      form.append('files', data, {
        filename: originalname,
        contentType: mimetype,
      });
      form.append('strategy', "fast");  // Must be one of ['fast', 'hi_res', 'auto', 'ocr_only']
      form.append('pdf_infer_table_structure', "true");
      const res = await axios.post(constants.UNSTRUCTURED_API_URL, form, {
        headers: {
          ...form.getHeaders(),
          'Content-Size': fileSizeInBytes,
          'Accept': 'application/json',
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });
      logger.debug('File uploaded to document service successfully.');
      return res.data;
    } catch (err) {
      logger.log('error', String(err), err.stack);
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

export default UnstructuredService;
