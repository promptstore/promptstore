const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

function DocumentsService({ constants, mc, logger }) {

  function read(filepath, maxBytes = 0, transformation, options) {
    return new Promise((resolve, reject) => {
      const localFilePath = `/tmp/${constants.FILE_BUCKET}/${filepath}`;
      const dirname = path.dirname(localFilePath);
      fs.mkdirSync(dirname, { recursive: true });
      const fileStream = fs.createWriteStream(localFilePath);
      mc.getPartialObject(constants.FILE_BUCKET, filepath, 0, maxBytes, async (err, dataStream) => {
        if (err) {
          logger.error(err);
          reject(err);
        }
        dataStream.on('data', (chunk) => {
          fileStream.write(chunk);
        });
        dataStream.on('end', () => {
          const contents = fs.readFileSync(localFilePath, { encoding: 'utf-8' });
          // logger.debug('contents: ', contents);
          if (typeof transformation === 'function') {
            const output = transformation(contents, options);
            // logger.debug('output: ', output);
            resolve(output);
          } else {
            resolve(contents);
          }
        });
      });
    });
  }

  const transformations = {
    csv: (text, options) => {
      // strip last maybe malformed record
      const index = text.lastIndexOf('\n');
      const input = text.slice(0, index);
      // logger.debug('input: ', input);
      return parse(input, options);
    },
  };

  return {
    read,
    transformations,
  };

}

module.exports = {
  DocumentsService,
}