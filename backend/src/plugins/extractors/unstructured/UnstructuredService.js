import FormData from 'form-data';
import axios from 'axios';
import fs from 'fs';
import uuid from 'uuid';

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
    logger.debug('extracting file content using the unstructured api');
    try {
      if (!fs.existsSync(file.path)) {
        return Promise.reject(new Error('File no longer on path: ' + file.path));
      }
      const stats = fs.statSync(file.path);
      logger.debug('stats:', stats);
      const fileSizeInBytes = stats.size;
      const data = await fs.promises.readFile(file.path);
      const form = new FormData();
      // must be `files` (plural) not `file`
      form.append('files', data, {
        filename: file.originalname,
        contentType: file.mimetype,
      });
      form.append('strategy', "hi_res");
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
      // logger.debug('res.data:', typeof res.data, res.data);
      return convertFormat(res.data);
    } catch (err) {
      logger.log('error', String(err), err.stack);
    }
  }

  function convertFormat(json) {
    let metadata;
    const stack = [];
    const documents = [];
    // const text = [];
    const structured_content = [];
    let i = 0;
    for (const item of json) {
      // logger.debug('item:', item);
      if (i === 0) {
        metadata = {
          ...item.metadata,
          doc_type: getDocType(item.metadata.filetype),
          record_id: item.metadata.filename.slice(0, item.metadata.filename.lastIndexOf('.')),
          created_date: '',
          last_mod_date: '',
          author: '',
          word_count: -1,
        };
      }
      // text.push(item.text);
      const type = getType(item.type);
      const content = {
        ...item,
        uid: uuid.v4(),
        type,
        subtype: item.type,
        text: item.text,
        element_id: item.element_id,
      };
      const n = stack.length;
      if (n && type === 'heading' && stack[n - 1].type === 'text') {
        const uid = uuid.v4();
        stack.forEach(it => {
          if (!it.parent_uids) {
            it.parent_uids = [];
          }
          it.parent_uids.push(uid);
        });
        documents.push({
          uid,
          items: stack.map(it => it.uid),
        });
        // const i = findLastIndex(stack, c => c.type === 'heading');
        // stack.splice(i);
        stack.length = 0;
      }
      stack.push(content);
      structured_content.push(content);
    }
    if (stack.length) {
      const uid = uuid.v4();
      stack.forEach(it => {
        if (!it.parent_uids) {
          it.parent_uids = [];
        }
        it.parent_uids.push(uid);
      });
      documents.push({
        uid,
        items: stack.map(it => it.uid),
      });
    }
    return {
      metadata,
      documents,
      data: {
        // text,
        structured_content,
      }
    };
  }

  function findLastIndex(arr, fn) {
    const a = [...arr].reverse();
    const i = a.findIndex(fn);
    return arr.length - i;
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

export default UnstructuredService;
