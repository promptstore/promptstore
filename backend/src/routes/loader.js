const { Table } = require('tableschema');

const { getExtension } = require('../utils');

module.exports = ({ app, auth, logger, services }) => {

  const { documentsService, indexesService, loaderService, searchService } = services;

  app.post('/api/dataloader', auth, async (req, res) => {
    const { uploadId, params } = req.body;
    const { indexId, newIndexName, engine } = params;
    if (indexId === 'new') {
      const schema = {
        content: {
          text: {
            name: 'text',
            dataType: 'Vector',
            mandatory: true,
          },
          type: {
            name: 'type',
            dataType: 'String',
            mandatory: true,
          },
          subtype: {
            name: 'subtype',
            dataType: 'String',
            mandatory: true,
          },
        }
      };
      const id = await indexesService.upsertIndex({
        name: newIndexName,
        engine,
        schema,
      });
      logger.debug(`Created new index '${newIndexName}' [${id}]`);
      const fields = searchService.getSearchSchema(schema);
      await searchService.createIndex(newIndexName, fields);
      await loaderService.indexData(uploadId, { ...params, indexId: id });
    } else {
      await loaderService.indexData(uploadId, params);
    }
    res.json({ status: 'OK' });
  });

  app.post('/api/loader', auth, async (req, res) => {
    const { filepath, params } = req.body;
    const { indexId, newIndexName, engine } = params;
    if (indexId === 'new') {
      const ext = getExtension(filepath);
      let schema;
      if (ext === 'csv') {
        const options = {
          bom: true,
          delimiter: params.delimiter,
          quote: params.quote,
          skip_records_with_error: true,
          trim: true,
        };
        const csv = await documentsService.read(filepath, 10000, documentsService.transformations.csv, options);
        const table = await Table.load(csv);
        await table.infer();
        const descriptor = table.schema.descriptor;
        logger.debug('descriptor: ', JSON.stringify(descriptor, null, 2));
        schema = toIndexSchema(descriptor);
      } else if (ext === 'txt') {
        schema = {
          content: {
            text: {
              name: 'text',
              dataType: 'Vector',
              mandatory: true,
            }
          }
        }
      }
      const id = await indexesService.upsertIndex({
        name: newIndexName,
        engine,
        schema,
      });
      logger.debug(`Created new index '${newIndexName}' [${id}]`);
      const fields = searchService.getSearchSchema(schema);
      await searchService.createIndex(newIndexName, fields);
      await loaderService.indexDocument(filepath, { ...params, indexId: id });

    } else {
      await loaderService.indexDocument(filepath, params);
    }
    res.json({ status: 'OK' });
  });

  const typeMappings = {
    'string': 'String',
    'integer': 'Integer',
  };

  const toIndexSchema = (descriptor) => {
    const props = descriptor.fields.reduce((a, f) => {
      a[f.name] = {
        name: f.name,
        dataType: typeMappings[f.type] || 'String',
        mandatory: false,
      };
      return a;
    }, {});
    return { content: props };
  };

};
