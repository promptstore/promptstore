const AdmZip = require('adm-zip');
const Promise = require('promise');
const fs = require('fs');
const multer = require('multer');
const os = require('os');
const path = require('path');
const { parse } = require('csv-parse');

module.exports = ({ app, constants, logger, mc, passport, pg, services }) => {

  const { cantoService, documentsService, searchService } = services;

  const upload = multer({ dest: os.tmpdir() });

  app.get('/api/workspaces/:workspaceId/uploads', passport.authenticate('keycloak', { session: false }), (req, res) => {
    const { workspaceId } = req.params;
    pg.query(
      'SELECT id, filename FROM file_uploads WHERE workspace_id = $1',
      [workspaceId],
      async (e, resp) => {
        if (e) {
          return logger.error(e);
        }
        const data = [];
        const prefix = path.join(workspaceId, constants.DOCUMENTS_PREFIX);
        const stream = mc.listObjects(constants.FILE_BUCKET, prefix, true);
        stream.on('data', (obj) => {
          data.push(obj);
        });
        stream.on('end', () => {
          const result = [];
          for (const row of resp.rows) {
            const obj = data.find((x) => x.name === path.join(prefix, row.filename));
            if (obj) {
              result.push({ ...row, ...obj });
            }
          }
          res.json(result);
        });
        stream.on('error', (err) => {
          logger.error(err);
          res.status(500).json({
            error: String(err),
          });
        });
      }
    );
  });

  app.get('/api/uploads/:id/content', passport.authenticate('keycloak', { session: false }), (req, res) => {
    const { id } = req.params;
    const { maxBytes } = req.query;
    let mb;
    try {
      mb = parseInt(maxBytes, 10);
    } catch (err) {
      mb = 0;
    }
    pg.query(
      'SELECT workspace_id, filename FROM file_uploads WHERE id = $1',
      [id],
      async (e, resp) => {
        if (e) {
          return logger.error(e);
        }
        const row = resp.rows[0];
        const objectName = path.join(String(row.workspace_id), constants.DOCUMENTS_PREFIX, row.filename);
        const ext = getExtension(objectName);
        if (ext === 'csv') {

          const options = {
            bom: true,
            columns: true,
            delimiter: ',',
            quote: '"',
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
  });

  app.post('/api/canto/uploads/status', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    logger.debug('body: ', JSON.stringify(req.body));
    const { tokenData } = req.body;
    const resp = await cantoService.getUploadStatus(tokenData);
    res.json(resp);
  });

  app.post('/api/canto', upload.single('file'), async (req, res, next) => {
    const {
      filename,
      tenant,
      tokenData,
    } = req.body;
    const file = req.file;
    const setting = await cantoService.getUploadSetting(tenant, tokenData);
    await cantoSetting.uploadFile(filename, file, setting, tokenData);
    res.sendStatus(200);
  });

  app.post('/api/upload', upload.single('file'), passport.authenticate('keycloak', { session: false }), (req, res) => {
    let {
      sourceId,
    } = req.body;
    const workspaceId = parseInt(sourceId, 10);
    const file = req.file;
    const metadata = {
      'Content-Type': file.mimetype,
    };
    const objectName = path.join(String(workspaceId), constants.DOCUMENTS_PREFIX, file.originalname);
    mc.fPutObject(constants.FILE_BUCKET, objectName, file.path, metadata, async (err, etag) => {
      if (err) {
        return logger.error(err);
      }
      logger.info('File uploaded successfully.');

      // TODO
      const userId = '1234';

      pg.query(
        'INSERT INTO file_uploads(workspace_id, user_id, filename) VALUES($1, $2, $3) RETURNING *',
        [workspaceId, userId, file.originalname],
        (e, resp) => {
          if (e) {
            return logger.error(e);
          }
          logger.info('Inserted', resp.rows[0]);
          res.sendStatus(200);
        }
      );

    });
  });

  app.delete('/api/uploads', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const names = req.query.names.split(',');
    const workspaceId = parseInt(req.query.workspaceId, 10);
    mc.removeObjects(constants.FILE_BUCKET, names, (err) => {
      if (err) {
        res.status(500).json({
          error: String(err),
        });
      } else {

        const filenames = names.map(n => n.split('/').pop());
        pg.query(
          'DELETE FROM file_uploads WHERE workspace_id = $1 AND filename = ANY($2::VARCHAR[])',
          [workspaceId, filenames],
          (e, resp) => {
            if (e) {
              return logger.error(e);
            }
            logger.info('Deleted', filenames);
            res.json(names);
          }
        );
      }
    });
  });

  function getExtension(filepath) {
    if (!filepath) return null;
    const index = filepath.lastIndexOf('.');
    return filepath.slice(index + 1);
  }

};