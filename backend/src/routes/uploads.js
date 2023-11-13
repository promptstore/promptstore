import multer from 'multer';
import path from 'path';

import { getExtension } from '../utils';

export default ({ app, auth, constants, logger, mc, services, workflowClient }) => {

  const { documentsService, uploadsService } = services;

  const upload = multer({ dest: '/var/data' });

  // cache of results to poll
  const jobs = {};

  app.get('/api/upload-status/:correlationId', auth, async (req, res) => {
    const { correlationId } = req.params;
    // logger.debug('checking upload status for:', correlationId);
    const result = jobs[correlationId];
    if (!result) {
      return res.sendStatus(423);
    }
    res.json(result);
    delete jobs[correlationId];
  });

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
        logger.error('Error listing objects:', err);
        res.status(500).json({
          error: String(err),
        });
      });

    } catch (err) {
      logger.error('Error getting uploads:', err);
      res.status(500).json({
        error: String(err),
      });
    }
  });

  app.get('/api/uploads/:id/content', auth, async (req, res) => {
    let mb = +req.query.maxbytes;
    if (isNaN(mb)) mb = 1000 * 1024;
    try {
      const upload = await uploadsService.getUpload(req.params.id);
      const ext = getExtension(upload.filename);
      if (!(ext === 'csv' || ext === 'txt')) {
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

      } else if (ext === 'txt') {
        const text = await documentsService.read(objectName, mb);
        res.json(text);
      }

    } catch (err) {
      logger.error('Error getting upload content:', err, err.stack);
      res.status(500).json({
        error: { message: String(err) },
      });
    }
  });

  app.post('/api/upload', upload.single('file'), auth, (req, res) => {
    let { correlationId, workspaceId } = req.body;
    const { username } = req.user;
    workspaceId = parseInt(workspaceId, 10);
    if (isNaN(workspaceId)) {
      return res.status(400).send({
        error: { message: 'Invalid workspace' },
      });
    }
    workflowClient
      .upload(req.file, workspaceId, username, {
        DOCUMENTS_PREFIX: constants.DOCUMENTS_PREFIX,
        FILE_BUCKET: constants.FILE_BUCKET,
      }, {
        address: constants.TEMPORAL_URL,
      })
      .then((result) => {
        // logger.debug('upload result:', result);
        if (correlationId) {
          jobs[correlationId] = result;
        }

        // allow 10m to poll for results
        setTimeout(() => {
          delete jobs[correlationId];
        }, 10 * 60 * 1000);

      });
    res.sendStatus(200);
  });

  app.post('/api/reload', auth, async (req, res) => {
    let { correlationId, workspaceId, uploadId, filepath } = req.body;
    const { username } = req.user;
    workspaceId = parseInt(workspaceId, 10);
    if (isNaN(workspaceId)) {
      return res.status(400).send({
        error: { message: 'Invalid workspace' },
      });
    }
    const file = await documentsService.download(filepath);
    // logger.debug('file:', file);
    workflowClient.reload(file, workspaceId, username, uploadId, {
      address: constants.TEMPORAL_URL,
    })
      .then((result) => {
        // logger.debug('upload result:', result);
        if (correlationId) {
          jobs[correlationId] = result;
        }

        // allow 10m to poll for results
        setTimeout(() => {
          delete jobs[correlationId];
        }, 10 * 60 * 1000);
      });

    res.sendStatus(200);
  });

  app.delete('/api/uploads', auth, (req, res, next) => {
    const names = req.query.names.split(',');
    const workspaceId = parseInt(req.query.workspace, 10);
    if (isNaN(workspaceId)) {
      return res.status(400).send({
        error: 'Invalid workspace',
      });
    }
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
        logger.error('Error deleting documents:', e);
        res.status(500).json({
          error: String(e),
        });
      }
    });
  });

};
