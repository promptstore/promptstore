const multer = require('multer');
const os = require('os');
const path = require('path');

const { getExtension } = require('../utils');

module.exports = ({ app, auth, constants, logger, mc, services }) => {

  const { documentsService, extractorService, uploadsService } = services;

  const upload = multer({ dest: os.tmpdir() });

  app.get('/api/workspaces/:workspaceId/uploads', auth, async (req, res) => {
    const { workspaceId } = req.params;
    try {
      const uploads = await uploadsService.getUploads(workspaceId);
      const data = [];
      const prefix = path.join(workspaceId, constants.DOCUMENTS_PREFIX);

      const stream = mc.listObjects(constants.FILE_BUCKET, prefix, true);

      stream.on('data', (obj) => {
        data.push(obj);
      });

      stream.on('end', () => {
        const result = [];
        for (const upload of uploads) {
          const obj = data.find((x) => x.name === path.join(prefix, upload.filename));
          if (obj) {
            result.push({ ...upload, ...obj });
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

    } catch (err) {
      logger.error(err);
      res.status(500).json({
        error: String(err),
      });
    }
  });

  app.get('/api/uploads/:id/content', auth, async (req, res) => {
    const { id } = req.params;
    const { maxBytes } = req.query;
    let mb;
    try {
      mb = parseInt(maxBytes, 10);
    } catch (err) {
      mb = 0;
    }
    try {
      const upload = await uploadsService.getUpload(id);
      const ext = getExtension(upload.filename);

      if (ext === 'pdf' || ext === 'docx') {
        return res.json(upload.data);
      }

      const objectName = path.join(String(upload.workspaceId), constants.DOCUMENTS_PREFIX, upload.filename);

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

    } catch (err) {
      logger.error(err);
      res.status(500).json({
        error: String(err),
      });
    }
  });

  app.post('/api/upload', upload.single('file'), auth, (req, res) => {
    let {
      sourceId,
    } = req.body;
    const workspaceId = parseInt(sourceId, 10);
    const file = req.file;
    logger.debug('file:', file);
    const metadata = { 'Content-Type': file.mimetype };
    const objectName = path.join(String(workspaceId), constants.DOCUMENTS_PREFIX, file.originalname);

    mc.fPutObject(constants.FILE_BUCKET, objectName, file.path, metadata, async (err) => {
      if (err) {
        logger.error(err);
        return res.status(500).json({
          error: String(err),
        });
      }
      logger.info('File uploaded successfully.');

      let data;
      if (
        file.mimetype === 'application/pdf' ||
        file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ) {
        data = await extractorService.extract(file);
      }

      // TODO
      const userId = '1234';

      try {
        const uploadRecord = {
          workspaceId,
          userId,
          filename: file.originalname,
          data,
        };
        const id = await uploadsService.upsertUpload(uploadRecord);
        logger.info('Inserted', { ...uploadRecord, id });

        res.sendStatus(200);

      } catch (err) {
        logger.error(err);
        res.status(500).json({
          error: String(err),
        });
      }
    });
  });

  app.delete('/api/uploads', auth, (req, res, next) => {
    const names = req.query.names.split(',');
    const workspaceId = parseInt(req.query.workspaceId, 10);
    mc.removeObjects(constants.FILE_BUCKET, names, async (err) => {
      if (err) {
        return res.status(500).json({
          error: String(err),
        });
      }
      const filenames = names.map(n => n.split('/').pop());
      try {
        await uploadsService.deleteWorkspaceFiles(workspaceId, filenames);
        res.json(names);
      } catch (e) {
        res.status(500).json({
          error: String(e),
        });
      }
    });
  });

};