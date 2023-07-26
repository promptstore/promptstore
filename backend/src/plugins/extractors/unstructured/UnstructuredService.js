const FormData = require('form-data');
const axios = require('axios');
const fs = require('fs');

function UnstructuredService({ __name, constants, logger }) {

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
   * Expected output format:
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
  async function extract(file) {
    try {
      const data = await fs.promises.readFile(file.path);
      const form = new FormData();
      form.append('file', data, {
        filename: file.originalname,
        contentType: file.mimetype,
      });
      const res = await axios.post(constants.UNSTRUCTURED_API_URL, form, {
        headers: {
          ...form.getHeaders(),
          'Accept': 'application/json',
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });
      logger.debug('File uploaded to document service successfully.');
      logger.debug('res: ', res.data);
      return res.data.map(convertFormat);
    } catch (err) {
      logger.log('error', String(err));
    }
  }

  function convertFormat(json) {
    let metadata;
    const text = [];
    const structured_data = [];
    let i = 0;
    for (const item of json) {
      if (i === 0) {
        metadata = {
          ...item.metadata,
          doc_type: getDocType(item.metadata.filetype),
          record_id: item.metadata.filename.slice(0, item.filename.metadata.lastIndexOf('.')),
          created_date: '',
          last_mod_date: '',
          author: '',
          word_count: -1,
        };
      }
      text.push(item);
      structured_data.push({
        type: getType(item.type),
        subtype: item.type,
        text: item.text,
        element_id: item.element_id,
      });
    }
    return {
      metadata,
      data: {
        text,
        structured_data,
      }
    };
  }

  function getDocType(filetype) {
    switch (filetype) {
      case 'application/pdf':
        return 'PDF';

      default:
        return '';
    }
  }

  function getType(itemType) {
    switch (itemType) {
      case 'Title':
        return 'heading';

      case 'UncategorizedText':
      case 'NarrativeText':
        return 'text';

      default:
        return 'text';
    }
  }

  return {
    __name,
    extract,
  };
}

module.exports = UnstructuredService;
