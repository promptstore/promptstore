import path from 'path';
import omit from 'lodash.omit';

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

export const createActivities = (mc, extractorService, uploadsService, logger) => ({

  async reload(file, workspaceId, username, uploadId) {
    let data;
    if (supportedMimetypes.includes(file.mimetype)) {
      data = await extractorService.extract('unstructured', file);
    }

    if (data) {
      try {
        const uploadRecord = {
          id: uploadId,
          workspaceId,
          filename: file.originalname,
          data,
        };
        const res = await uploadsService.upsertUpload(uploadRecord, username);
        logger.info('Updated', res);
        return 'OK';

      } catch (err) {
        logger.error(String(err));
        throw err;
      }
    } else {
      logger.info('No data');
    }
  },

  upload(file, workspaceId, username, constants) {
    logger.info('file:', file);
    logger.info('workspaceId:', workspaceId);
    logger.info('username:', username);
    logger.info('constants:', constants);
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

        try {
          const uploadRecord = {
            workspaceId,
            filename: file.originalname,
            data,
          };
          const uploaded = await uploadsService.upsertUpload(uploadRecord, username);
          logger.info('Inserted', uploaded);

          mc.statObject(constants.FILE_BUCKET, objectName, (err, stat) => {
            if (err) {
              logger.error(String(err));
              reject(err);
            }
            const record = omit(uploaded, ['data']);
            resolve({
              ...record,
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
