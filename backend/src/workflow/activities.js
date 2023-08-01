const path = require('path');

const supportedMimetypes = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-outlook',
  'application/octet-stream',
  'message/rfc822',
  'text/html',
  'application/json',
  'application/epub+zip',
  'application/vnd.oasis.opendocument.text',
  'application/rtf',
  'text/plain',
  'application/xml',
  'text/xml',
];

const createActivities = (mc, extractorService, uploadsService, logger) => ({

  async reload(file, workspaceId, uploadId) {
    let data;
    if (supportedMimetypes.includes(file.mimetype)) {
      data = await extractorService.extract('unstructured', file);
    }

    if (data) {
      // TODO
      const userId = '1234';

      try {
        const uploadRecord = {
          id: uploadId,
          workspaceId,
          userId,
          filename: file.originalname,
          data,
        };
        const res = await uploadsService.upsertUpload(uploadRecord);
        logger.info('Updated', res);
        return res;

      } catch (err) {
        logger.error(String(err));
        throw err;
      }
    } else {
      logger.info('No data');
    }
  },

  upload(file, workspaceId, constants) {
    const metadata = {
      filename: file.originalname,
      'Content-Type': file.mimetype,
    };
    const objectName = path.join(
      String(workspaceId),
      constants.DOCUMENTS_PREFIX,
      file.originalname
    );
    return new Promise((resolve, reject) => {
      mc.fPutObject(constants.FILE_BUCKET, objectName, file.path, metadata, async (err) => {
        if (err) {
          logger.error(String(err));
          reject(err);
        }
        logger.info('File uploaded successfully.');

        let data;
        if (supportedMimetypes.includes(file.mimetype)) {
          data = await extractorService.extract('unstructured', file);
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

          mc.statObject(constants.FILE_BUCKET, objectName, (err, stat) => {
            if (err) {
              logger.error(String(err));
              reject(err);
            }
            resolve({
              ...uploadRecord,
              id,
              etag: stat.etag,
              size: stat.size,
              lastModified: stat.lastModified,
              name: objectName,
            });
          });

        } catch (err) {
          logger.error(String(err));
          reject(err);
        }
      });
    });
  },

});

module.exports = { createActivities };
