const FormData = require('form-data');
const axios = require('axios');
const fs = require('fs');

function OnesourceService({ __name, constants, logger }) {

  /**
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
      const res = await axios.post(constants.ONESOURCE_API_URL, form, {
        headers: form.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });
      logger.debug('File uploaded to document service successfully.');
      logger.debug('res: ', res.data);
      return res.data;
    } catch (err) {
      logger.log('error', String(err));
    }
  }

  return {
    __name,
    extract,
  };
}

module.exports = OnesourceService;
