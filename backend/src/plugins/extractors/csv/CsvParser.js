import { infer } from 'tableschema';
import { parse } from 'csv-parse/sync';
import uuid from 'uuid';

import { getTextStats } from '../../../utils';

function CsvParser({ __name, constants, logger }) {

  const allowedExtensions = ['csv'];

  const defaultOptions = {
    bom: true,
    columns: true,
    delimiter: ',',
    quote: '"',
    skip_records_with_error: true,
    skip_empty_lines: true,
    trim: true,
  };

  async function getChunks(documents, params) {
    const {
      textNodeProperties,
      nodeLabel = 'Chunk',
    } = params;
    const options = {
      ...defaultOptions,
      ...params.options,
    };
    logger.debug('options:', options);
    const chunks = [];
    for (const doc of documents) {
      if (!allowedExtensions.includes(doc.ext)) {
        continue;
      }
      // strip last maybe malformed record
      const index = doc.content.lastIndexOf('\n');
      const content = doc.content.slice(0, index);
      const rows = parse(content, options);
      if (params.raw) {
        return rows;
      }
      let schema = params.schema;
      if (!schema) {
        schema = await getSchema({
          rows: [
            Object.keys(rows[0]),
            ...rows.map(Object.values)
          ],
          textNodeProperties,
        });
      }
      const props = schema.properties.data.properties;
      const createdDateTime = new Date().toISOString();
      chunks.push(...rows.map((data, i) => {
        const text = Object.entries(data)
          .map(([k, v]) => {
            if (props[k].type === 'string') {
              return k + ': ' + v;
            }
            return '';
          })
          .filter(([k, v]) => v)
          .join('\n')
          ;
        const { wordCount, length, size } = getTextStats(text);
        return {
          id: uuid.v4(),
          nodeLabel,
          type: 'record',
          documentId: doc.id,
          text,
          imageURI: null,
          data,
          metadata: {
            author: null,
            mimetype: 'text/csv',
            dataSourceId: doc.dataSourceId,
            dataSourceName: doc.dataSourceName,
            uploadId: null,
            objectName: doc.filename,
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
          createdBy: constants.CREATED_BY,
          startDateTime: createdDateTime,
          endDateTime: null,
          version: 1,
        };
      }));
    }
    return chunks;
  }

  async function getSchema({ content, options, rows, headers = 1, textNodeProperties }) {
    if (!rows) {
      rows = parse(content, { ...options, columns: false });
    }
    // logger.debug('rows:', rows.slice(0, 3));
    const schema = await infer(rows, { headers });
    logger.debug('schema:', schema);
    // logger.debug('textNodeProperties:', textNodeProperties);

    const props = schema.fields.reduce((a, f) => {
      const isTag = (
        f.type === 'string' &&
        textNodeProperties &&
        !textNodeProperties.includes(f.name)
      );
      a[f.name] = {
        type: f.type,
        tag: isTag,
      };
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
          "description": "The type of chunk if defined, e.g., \"Title\", \"NarrativeText\", \"Image\"",
        },
        "text": {
          "type": "string",
          "description": "The chunk text",
        },
        "data": {
          "type": "object",
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

export default CsvParser;
