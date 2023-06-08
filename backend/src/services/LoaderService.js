const { parse } = require('csv-parse');

function LoaderService({ logger, services }) {

  const {
    documentsService,
    functionsService,
    indexesService,
    openaiService,
    searchService,
  } = services;

  async function load(filepath, params) {
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

        chunks = await openaiService.executeFunction('chunk', { text });

      } else {

        throw new Error('Splitter not supported');

      }

      const docs = chunks.map((c) => ({ [textProperty]: c, nodeType: 'content' }));
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

      const docs = records.map((r) => ({ ...r, nodeType: 'content' }));
      indexChunks(indexId, docs);

    } else {

      throw new Error('File type not supported');

    }
  }

  function getExtension(filepath) {
    if (!filepath) return null;
    const index = filepath.lastIndexOf('.');
    return filepath.slice(index + 1);
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
    load,
  };

}

module.exports = {
  LoaderService,
}