const { parse } = require('csv-parse/sync');

const { getExtension } = require('../utils');

function LoaderService({ logger, services }) {

  const {
    documentsService,
    executionsService,
    functionsService,
    indexesService,
    searchService,
    uploadsService,
  } = services;

  async function indexDocument(filepath, params) {
    const {
      characters = '\n\n',
      delimiter = ',',
      functionId,
      indexId,
      quote = '"',
      splitter,
      textProperty = 'text',
    } = params;
    const ext = getExtension(filepath);

    if (ext === 'txt') {

      const text = await documentsService.read(filepath);

      let chunks;
      if (splitter === 'delimiter') {

        chunks = text.split(characters);

      } else if (splitter === 'chunker') {

        const func = await functionsService.getFunction(functionId);

        if (!func) {
          throw new Error('Chunker function not found');
        }

        chunks = await executionsService.executeFunction('chunk', { text });

      } else {

        throw new Error('Splitter not supported');

      }

      const docs = chunks.map((chunk) => ({ [textProperty]: chunk, nodeType: 'content' }));
      indexChunks(indexId, docs);

    } else if (ext === 'csv') {

      const text = await documentsService.read(filepath);

      const options = {
        bom: true,
        columns: true,
        delimiter,
        quote,
        skip_records_with_error: true,
        trim: true,
      };

      const records = parse(text, options);

      const docs = records.map((rec) => ({ ...rec, nodeType: 'content' }));
      await indexChunks(indexId, docs);

    } else {

      throw new Error('File type not supported');

    }
  }

  async function indexData(uploadId, { indexId }) {
    const upload = await uploadsService.getUpload(uploadId);

    if (!upload) {
      throw new Error('Upload not found');
    }

    const chunks = upload.data.data.structured_content;
    const docs = chunks.map((chunk) => {
      if (chunk.type === 'list') {
        return {
          type: chunk.type,
          subtype: chunk.subtype,
          text: chunk.heading + '\n' + chunk.items.map((it) => '- ' + it).join('\n'),
          nodeType: 'content',
        };
      } else {
        return {
          ...chunk,
          nodeType: 'content',
        };
      }
    });
    await indexChunks(indexId, docs);
  }

  async function indexChunks(indexId, chunks) {
    const index = await indexesService.getIndex(indexId);

    if (!index) {
      throw new Error('Index not found');
    }

    const indexDoc = (doc) => searchService.indexDocument(index.name, doc);
    const promises = chunks.map(indexDoc);
    await Promise.all(promises);
  }

  return {
    indexDocument,
    indexData,
  };

}

module.exports = {
  LoaderService,
}