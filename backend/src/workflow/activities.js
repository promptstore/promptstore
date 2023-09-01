import omit from 'lodash.omit';
import path from 'path';

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

export const createActivities = ({
  mc,
  dataSourcesService,
  destinationsService,
  executionsService,
  extractorService,
  functionsService,
  sqlSourceService,
  uploadsService,
  logger,
}) => ({

  async reload(file, workspaceId, username, uploadId) {
    let data;
    if (supportedMimetypes.includes(file.mimetype)) {
      if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        data = await extractorService.extract('onesource', file);
      } else {
        data = await extractorService.extract('unstructured', file);
      }
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
          if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
            data = await extractorService.extract('onesource', file);
          } else {
            data = await extractorService.extract('unstructured', file);
          }
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

  async transform(transformation, workspaceId, username) {
    logger.info('transformation:', transformation);
    logger.info('workspaceId:', workspaceId);
    logger.info('username:', username);
    const source = await dataSourcesService.getDataSource(transformation.dataSourceId);
    const rows = await sqlSourceService.getData(source, 3);
    // logger.debug('data:', data);
    const res = [];
    const features = transformation.features || [];
    for (const row of rows) {
      const result = {};
      for (const feature of features) {
        if (feature.functionId === '__pass') {
          if (feature.column === '__all') {
            for (const [k, v] of Object.entries(row)) {
              result[k] = v;
            }
            continue;
          }
          result[feature.name] = row[feature.column];
          continue;
        }
        const func = await functionsService.getFunction(feature.functionId);
        if (func) {
          let text;
          if (feature.column === '__all') {
            // TODO - review
            text = JSON.stringify(row);
          } else {
            text = row[feature.column];
          }
          if (text) {
            const args = { text };
            const { response, errors } = await executionsService.executeFunction({
              workspaceId,
              username,
              func,
              args,
              params: {},
            });
            if (!errors) {
              result[feature.name] = response.value;
            }
          }
        }
      }
      res.push(result);
    }
    // logger.info('res:', res);
    for (const dstId of transformation.destinationIds) {
      const dst = await destinationsService.getDestination(dstId);
      if (dst) {
        await sqlSourceService.createTable(dst, res);
      }
    }
    return { status: 'OK' };
  }

});
