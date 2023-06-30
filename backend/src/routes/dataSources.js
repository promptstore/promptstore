const path = require('path');

module.exports = ({ app, auth, constants, logger, pg, services }) => {

  const { dataSourcesService, documentsService } = services;

  app.get('/api/data-sources', auth, async (req, res, next) => {
    const { type } = req.query;
    let dataSources;
    if (type) {
      dataSources = await dataSourcesService.getDataSourcesByType(type);
    } else {
      dataSources = await dataSourcesService.getDataSources();
    }
    res.json(dataSources);
  });

  app.get('/api/data-sources/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    const index = await dataSourcesService.getDataSource(id);
    res.json(index);
  });

  app.get('/api/data-sources/:id/content', auth, (req, res) => {
    const { id } = req.params;
    const { maxBytes } = req.query;
    let mb;
    try {
      mb = parseInt(maxBytes, 10);
    } catch (err) {
      mb = 0;
    }
    pg.query(
      'SELECT val FROM data_sources WHERE id = $1',
      [id],
      async (e, resp) => {
        if (e) {
          logger.error(e);
          return res.sendStatus(500);
        }
        const row = resp.rows[0];
        const {
          documentId,
          documentType,
          delimiter = ',',
          quoteChar = '"',
        } = row.val;
        pg.query(
          'SELECT workspace_id, filename FROM file_uploads WHERE id = $1',
          [documentId],
          async (e, resp) => {
            if (e) {
              logger.error(e);
              return res.sendStatus(500);
            }
            const row = resp.rows[0];
            const objectName = path.join(String(row.workspace_id), constants.DOCUMENTS_PREFIX, row.filename);
            if (documentType === 'csv') {

              const options = {
                bom: true,
                columns: true,
                delimiter,
                quote: quoteChar,
                skip_records_with_error: true,
                trim: true,
              };

              const output = await documentsService.read(
                objectName,
                mb,
                documentsService.transformations.csv,
                options
              );
              res.json(output);

            } else {

              const text = await documentsService.read(objectName, mb);
              res.json(text);

            }
          }
        );
      }
    );
  });

  app.post('/api/data-sources', auth, async (req, res, next) => {
    const values = req.body;
    const id = await dataSourcesService.upsertDataSource(values);
    res.json(id);
  });

  app.put('/api/data-sources/:id', auth, async (req, res, next) => {
    const { id } = req.params;
    const values = req.body;
    await dataSourcesService.upsertDataSource({ id, ...values });
    res.json({ status: 'OK' });
  });

  app.delete('/api/data-sources/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    await dataSourcesService.deleteDataSources([id]);
    res.json(id);
  });

  app.delete('/api/data-sources', auth, async (req, res, next) => {
    const ids = req.query.ids.split(',');
    await dataSourcesService.deleteDataSources(ids);
    res.json(ids);
  });

};
