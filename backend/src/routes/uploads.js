import fs from 'fs';
import isEmpty from 'lodash.isempty';
import multer from 'multer';
import path from 'path';
import uuid from 'uuid';

import searchFunctions from '../searchFunctions';
import { getExtension } from '../utils';

export default ({ app, auth, constants, logger, mc, services, workflowClient }) => {

  const OBJECT_TYPE = 'uploads';

  const {
    appsService,
    compositionsService,
    dataSourcesService,
    documentsService,
    extractorService,
    functionsService,
    graphStoreService,
    imagesService,
    indexesService,
    modelsService,
    promptSetsService,
    settingsService,
    uploadsService,
    vectorStoreService,
  } = services;

  const { deleteObjects, deleteObject, indexObject } = searchFunctions({ constants, logger, services });

  const upload = multer({ dest: constants.FILESTORE_PREFIX + '/var/data' });

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

  app.get('/api/apps/:appId/uploads', auth, async (req, res) => {
    const { appId } = req.params;
    try {
      const app = await appsService.getApp(appId);
      logger.debug('app:', app);
      const uploads = await uploadsService.getAppUploads(app.workspaceId, appId);
      const data = [];
      const prefix = path.join(String(app.workspaceId), constants.DOCUMENTS_PREFIX, 'apps', appId);

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

  app.get('/api/uploads', auth, async (req, res) => {
    const objectName = decodeURIComponent(req.query.objectName);
    const upload = await uploadsService.getUploadByObjectName(objectName);
    res.json(upload);
  });

  function getOnesourceType(itemType) {
    switch (itemType) {
      case 'Title':
        return 'heading';

      case 'UncategorizedText':
      case 'NarrativeText':
        return 'text';

      default:
        return 'text';
    }
  }

  function convertToOnesourceFormat(json) {
    if (!Array.isArray(json)) {
      return null;
    }
    let metadata;
    const stack = [];
    const documents = [];
    const text = [];
    const structured_content = [];
    let i = 0;
    for (const item of json) {
      if (i === 0) {
        metadata = {
          ...item.metadata,
          doc_type: item.metadata.filetype,
          record_id: item.metadata.filename.slice(0, item.metadata.filename.lastIndexOf('.')),
          created_date: new Date().toISOString(),
          last_mod_date: new Date().toISOString(),
          author: '',
          word_count: -1,
        };
      }
      text.push(item.text);
      const type = getOnesourceType(item.type);
      const content = {
        ...item,
        uid: uuid.v4(),
        type,
        subtype: item.type,
        text: item.text,
        element_id: item.element_id,
      };
      const n = stack.length;
      if (n && type === 'heading' && stack[n - 1].type === 'text') {
        const uid = uuid.v4();
        stack.forEach(it => {
          if (!it.parent_uids) {
            it.parent_uids = [];
          }
          it.parent_uids.push(uid);
        });
        documents.push({
          uid,
          items: stack.map(it => it.uid),
        });
        // const i = findLastIndex(stack, c => c.type === 'heading');
        // stack.splice(i);
        stack.length = 0;
      }
      stack.push(content);
      structured_content.push(content);
    }
    if (stack.length) {
      const uid = uuid.v4();
      stack.forEach(it => {
        if (!it.parent_uids) {
          it.parent_uids = [];
        }
        it.parent_uids.push(uid);
      });
      documents.push({
        uid,
        items: stack.map(it => it.uid),
      });
    }
    return {
      metadata,
      documents,
      data: {
        text,
        structured_content,
      }
    };
  }

  app.get('/api/uploads/:id/content', auth, async (req, res) => {
    let mb = +req.query.maxbytes;
    if (isNaN(mb)) mb = 1000 * 1024;
    try {
      const upload = await uploadsService.getUpload(req.params.id);
      const ext = getExtension(upload.filename);
      // logger.debug('upload:', upload, ext);
      if (!(ext === 'csv' || ext === 'txt')) {
        const formatted = convertToOnesourceFormat(upload.data);
        return res.json(formatted);
      }

      const objectName = path.join(String(upload.workspaceId), constants.DOCUMENTS_PREFIX, upload.filename);
      if (ext === 'csv') {
        const content = await documentsService.read(objectName, mb);
        const output = await extractorService.getChunks('csv', [{ content, ext: 'csv' }], { raw: true });
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

  async function importObject(workspaceId, username, type, obj) {
    let r;
    if (type === 'composition') {
      delete obj.id;
      const name = obj.name.trim();
      const compositions = await compositionsService.getCompositionsByName(workspaceId, name);
      logger.debug('existing compositions found:', compositions.length);
      if (compositions.length) {
        let version = 0;
        let exactMatch = false;
        for (const comp of compositions) {
          const match = comp.name.match(/(.*?)(\d+)$/);
          if (match && match[1].trim() === name) {
            const ver = parseInt(match[2], 10);
            version = Math.max(version, ver);
          } else if (comp.name.trim() === name) {
            exactMatch = true;
          }
        }
        if (version > 0 || exactMatch) {
          obj = { ...obj, name: name + ' ' + (version + 1), workspaceId };
        } else {
          obj = { ...obj, name, workspaceId };
        }
      } else {
        obj = { ...obj, name, workspaceId };
      }
      logger.debug('obj:', obj);
      r = await compositionsService.upsertComposition(obj, username);
    } else if (type === 'function') {
      if (obj.model) {
        const models = await modelsService.getModelsByName(workspaceId, obj.model.name);
        if (models.length) {
          obj = { ...obj, modelId: models[0].id };
        } else {
          const model = { ...obj.model, id: null, workspaceId };
          const { id } = await modelsService.upsertModel(model, username);
          obj = { ...obj, modelId: id };
        }
        delete obj.model;
      }
      if (obj.promptSet) {
        const sets = await promptSetsService.getPromptSetsByName(workspaceId, obj.promptSet.name);
        if (sets.length) {
          obj = { ...obj, promptSetId: sets[0].id };
        } else {
          const promptSet = { ...obj.promptSet, id: null, workspaceId };
          const { id } = await promptSetsService.upsertPromptSet(promptSet, username);
          obj = { ...obj, promptSetId: id };
        }
        delete obj.promptSet;
      }
      delete obj.id;
      const name = obj.name.trim();
      const functions = await functionsService.getFunctionsByName(workspaceId, name);
      logger.debug('existing functions found:', functions.length);
      if (functions.length) {
        let version = 0;
        let exactMatch = false;
        for (const func of functions) {
          const match = func.name.match(/(.*?)(\d+)$/);
          if (match && match[1].trim() === name) {
            const ver = parseInt(match[2], 10);
            version = Math.max(version, ver);
          } else if (func.name.trim() === name) {
            exactMatch = true;
          }
        }
        if (version > 0 || exactMatch) {
          obj = { ...obj, name: name + ' ' + (version + 1), workspaceId };
        } else {
          obj = { ...obj, name, workspaceId };
        }
      } else {
        obj = { ...obj, name, workspaceId };
      }
      logger.debug('obj:', obj);
      const tagsSetting = await settingsService.getSettingsByKey(workspaceId, 'functionTags');
      let value = [...(obj.tags || [])];
      if (tagsSetting?.length) {
        value.push(...(tagsSetting[0].value || []));
        value = [...new Set(value)];
        value.sort((a, b) => a < b ? -1 : 1);
        await settingsService.upsertSetting({ ...tagsSetting[0], value }, username);
      } else {
        value = [...new Set(value)];
        value.sort((a, b) => a < b ? -1 : 1);
        await settingsService.upsertSetting({
          workspaceId,
          key: 'functionTags',
          settingType: 'json',
          value,
        }, username);
      }
      r = await functionsService.upsertFunction(obj, username);
    } else if (type === 'model') {
      delete obj.id;
      const name = obj.name.trim();
      const models = await modelsService.getModelsByName(workspaceId, name);
      logger.debug('existing models found:', models.length);
      if (models.length) {
        let version = 0;
        let exactMatch = false;
        for (const model of models) {
          const match = model.name.match(/(.*?)(\d+)$/);
          if (match && match[1].trim() === name) {
            const ver = parseInt(match[2], 10);
            version = Math.max(version, ver);
          } else if (model.name.trim() === name) {
            exactMatch = true;
          }
        }
        if (version > 0 || exactMatch) {
          obj = { ...obj, name: name + ' ' + (version + 1), workspaceId };
        } else {
          obj = { ...obj, name, workspaceId };
        }
      } else {
        obj = { ...obj, name, workspaceId };
      }
      logger.debug('obj:', obj);
      r = await modelsService.upsertModel(obj, username);
    } else if (type === 'promptSet') {
      delete obj.id;
      const name = obj.name.trim();
      const sets = await promptSetsService.getPromptSetsByName(workspaceId, name);
      logger.debug('existing prompt sets found:', sets.length);
      if (sets.length) {
        let version = 0;
        let exactMatch = false;
        for (const set of sets) {
          const match = set.name.match(/(.*?)(\d+)$/);
          if (match && match[1].trim() === name) {
            const ver = parseInt(match[2], 10);
            version = Math.max(version, ver);
          } else if (set.name.trim() === name) {
            exactMatch = true;
          }
        }
        if (version > 0 || exactMatch) {
          const match = obj.skill.match(/(.*?)_\d+$/);
          let skill;
          if (match) {
            skill = `${match[1]}_${version + 1}`;
          } else {
            skill = `${obj.skill}_${version + 1}`;
          }
          obj = {
            ...obj,
            name: name + ' ' + (version + 1),
            skill,
            workspaceId,
          };
        } else {
          obj = { ...obj, name, workspaceId };
        }
      } else {
        obj = { ...obj, name, workspaceId };
      }
      logger.debug('obj:', obj);
      const tagsSetting = await settingsService.getSettingsByKey(workspaceId, 'promptSetTags');
      let value = [...(obj.tags || [])];
      if (tagsSetting?.length) {
        value.push(...(tagsSetting[0].value || []));
        value = [...new Set(value)];
        value.sort((a, b) => a < b ? -1 : 1);
        await settingsService.upsertSetting({ ...tagsSetting[0], value }, username);
      } else {
        value = [...new Set(value)];
        value.sort((a, b) => a < b ? -1 : 1);
        await settingsService.upsertSetting({
          workspaceId,
          key: 'promptSetTags',
          settingType: 'json',
          value,
        }, username);
      }
      const skillsSetting = await settingsService.getSettingsByKey(workspaceId, 'skills');
      value = [obj.skill];
      if (skillsSetting?.length) {
        value.push(...(skillsSetting[0].value || []));
        value = [...new Set(value)];
        value.sort((a, b) => a < b ? -1 : 1);
        await settingsService.upsertSetting({ ...skillsSetting[0], value }, username);
      } else {
        value = [...new Set(value)];
        value.sort((a, b) => a < b ? -1 : 1);
        await settingsService.upsertSetting({
          workspaceId,
          key: 'skills',
          settingType: 'json',
          value,
        }, username);
      }
      r = await promptSetsService.upsertPromptSet(obj, username);
    }
    logger.debug('r:', r);
    return r;
  }

  app.post('/api/workspaces/:workspaceId/fix-promptset-tag-setting', auth, async (req, res) => {
    const { workspaceId } = req.params;
    const { username } = req.user;
    let value = [];
    const promptSets = await promptSetsService.getPromptSets(workspaceId);
    for (const ps of promptSets) {
      if (ps.tags) {
        value.push(...ps.tags);
      }
    }
    value = [...new Set(value)];
    value.sort((a, b) => a < b ? -1 : 1);
    const tagsSetting = await settingsService.getSettingsByKey(workspaceId, 'promptSetTags');
    if (tagsSetting?.length) {
      await settingsService.upsertSetting({ ...tagsSetting[0], value }, username);
    } else {
      await settingsService.upsertSetting({
        workspaceId,
        key: 'promptSetTags',
        settingType: 'json',
        value,
      }, username);
    }
    res.json('OK');
  });

  app.post('/api/workspaces/:workspaceId/fix-function-tag-setting', auth, async (req, res) => {
    const { workspaceId } = req.params;
    const { username } = req.user;
    let value = [];
    const funcs = await functionsService.getFunctions(workspaceId);
    for (const func of funcs) {
      if (func.tags) {
        value.push(...func.tags);
      }
    }
    value = [...new Set(value)];
    value.sort((a, b) => a < b ? -1 : 1);
    const tagsSetting = await settingsService.getSettingsByKey(workspaceId, 'functionTags');
    if (tagsSetting?.length) {
      await settingsService.upsertSetting({ ...tagsSetting[0], value }, username);
    } else {
      await settingsService.upsertSetting({
        workspaceId,
        key: 'functionTags',
        settingType: 'json',
        value,
      }, username);
    }
    res.json('OK');
  });

  app.post('/api/workspaces/:workspaceId/fix-skill-setting', auth, async (req, res) => {
    const { workspaceId } = req.params;
    const { username } = req.user;
    let value = [];
    const promptSets = await promptSetsService.getPromptSets(workspaceId);
    for (const ps of promptSets) {
      value.push(ps.skill);
    }
    value = [...new Set(value)];
    value.sort((a, b) => a < b ? -1 : 1);
    const tagsSetting = await settingsService.getSettingsByKey(workspaceId, 'skills');
    if (tagsSetting?.length) {
      await settingsService.upsertSetting({ ...tagsSetting[0], value }, username);
    } else {
      await settingsService.upsertSetting({
        workspaceId,
        key: 'skills',
        settingType: 'json',
        value,
      }, username);
    }
    res.json('OK');
  });

  app.post('/api/object-duplicates', auth, async (req, res) => {
    const { username } = req.user;
    try {
      const { obj, type, workspaceId } = req.body;
      const result = await importObject(workspaceId, username, type, obj);
      res.json(result);
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      logger.error(message);
      res.sendStatus(500);
    }
  });

  app.post('/api/object-uploads', upload.single('file'), auth, async (req, res) => {
    // logger.debug('body:', req.body);
    const { username } = req.user;
    try {
      const { type, workspaceId } = req.body;
      const str = fs.readFileSync(req.file.path);
      let obj = JSON.parse(str);
      const results = [];
      if (Array.isArray(obj)) {
        for (const o of obj) {
          const r = await importObject(workspaceId, username, type, o);
          results.push(r);
        }
      } else {
        const r = await importObject(workspaceId, username, type, obj);
        results.push(r);
      }
      res.json(results);
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      logger.error(message);
      res.sendStatus(500);
    }
  });

  app.post('/api/upload', upload.single('file'), auth, (req, res) => {
    let { correlationId, workspaceId, appId } = req.body;
    const isImage = req.body.isImage === 'true';
    const { username } = req.user;
    workspaceId = parseInt(workspaceId, 10);
    if (isNaN(workspaceId)) {
      return res.status(400).json({
        error: { message: 'Invalid workspace' },
      });
    }
    if (appId) {
      appId = parseInt(appId, 10);
      if (isNaN(appId)) {
        return res.status(400).json({
          error: { message: 'Invalid app' },
        });
      }
    }
    logger.debug('workspace id:', workspaceId);
    logger.debug('app id:', appId);
    workflowClient
      .upload(req.file, workspaceId, appId, username, {
        DOCUMENTS_PREFIX: isImage ? constants.IMAGES_PREFIX : constants.DOCUMENTS_PREFIX,
        FILE_BUCKET: constants.FILE_BUCKET,
      }, {
        address: constants.TEMPORAL_URL,
      })
      .then((result) => {
        // logger.debug('upload result:', result);
        if (correlationId) {
          if (isImage) {
            mc.presignedUrl('GET', constants.FILE_BUCKET, result.name, async (err, presignedUrl) => {
              if (err) {
                let message = 'Error getting presigned url: ';
                if (err instanceof Error) {
                  message += err.message;
                  if (err.stack) {
                    message += '\n' + err.stack;
                  }
                } else {
                  message += err.toString();
                }
                logger.error(message);
                return res.status(400).json({
                  error: { message },
                });
              }
              logger.debug('presigned url:', presignedUrl);
              let imageUrl;
              if (constants.ENV === 'dev') {
                const u = new URL(presignedUrl);
                imageUrl = constants.BASE_URL + '/api/dev/images' + u.pathname + u.search;
              } else {
                imageUrl = presignedUrl;
              }

              const { width, height, size, name, etag, appId, filename } = result;
              const values = {
                workspaceId,
                imageId: uuid.v4(),
                imageUrl,
                objectName: name,
                width,
                height,
                size,
                etag,
                appId,
                filename,
              };
              const image = await imagesService.upsertImage(values, username);

              jobs[correlationId] = image;
            });
          } else {
            jobs[correlationId] = result;
          }
        }

        // allow 10m to poll for results
        setTimeout(() => {
          delete jobs[correlationId];
        }, 10 * 60 * 1000);

        if (!isImage) {
          const obj = createSearchableObject(result);

          // TODO
          indexObject(obj);
        }

      });
    res.sendStatus(200);
  });

  app.post('/api/reload', auth, async (req, res) => {
    let { correlationId, workspaceId, uploadId, filepath } = req.body;
    const { username } = req.user;
    workspaceId = parseInt(workspaceId, 10);
    if (isNaN(workspaceId)) {
      return res.status(400).json({
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

  app.delete('/api/uploads', auth, async (req, res, next) => {
    const { username } = req.user;
    const names = req.query.names.split(',');
    const workspaceId = parseInt(req.query.workspace, 10);
    if (isNaN(workspaceId)) {
      return res.status(400).json({
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
      let uploadIds;
      try {
        uploadIds = await uploadsService.deleteWorkspaceFiles(workspaceId, filenames);
        const appId = parseInt(req.query.app, 10);
        if (!isNaN(appId)) {
          const { documents, indexes } = await appsService.getApp(appId);
          const newDocuments = { ...documents };
          let newIndexes = [...indexes];
          if (!isEmpty(documents)) {
            for (const uploadId of uploadIds) {
              const doc = documents[uploadId];
              if (doc) {
                if (doc.index) {
                  await deletePhysicalIndexAndData(doc.index);
                  await indexesService.deleteIndexes([doc.index]);
                  await deleteObject('indexes:' + doc.index);
                }
                if (doc.dataSource) {
                  await dataSourcesService.deleteDataSources([doc.dataSource]);
                  await deleteObject('data-sources:' + doc.dataSource);
                }
                delete newDocuments[uploadId];
                newIndexes = newIndexes.filter(x => x !== doc.index);
              }
            }
          }
          const app = await appsService.upsertApp({
            id: appId,
            documents: newDocuments,
            indexes: newIndexes,
          }, username, true);

          // TODO
          // await deleteObjects(ids.map(objectId));

          return res.json(app);
        }

        res.json(uploadIds);
      } catch (e) {
        logger.error('Error deleting documents:', e);
        res.json(uploadIds);
        // res.status(500).json({
        //   error: String(e),
        // });
      }
    });
  });

  async function deletePhysicalIndexAndData(indexId) {
    const { name, nodeLabel, vectorStoreProvider, graphStoreProvider } = await indexesService.getIndex(indexId);
    if (vectorStoreProvider) {
      try {
        await vectorStoreService.dropData(vectorStoreProvider, name, { nodeLabel });
        await vectorStoreService.dropIndex(vectorStoreProvider, name);
      } catch (err) {
        logger.error(`Error dropping index %s:%s:`, vectorStoreProvider, name, err);
        // maybe no such index
      }
    } else if (graphStoreProvider) {
      try {
        await graphStoreService.dropData(graphStoreProvider);
      } catch (err) {
        logger.error(`Error dropping data from %s:%s:`, graphStoreProvider, name, err);
        // maybe no such store
      }
    }
  }

  const objectId = (id) => OBJECT_TYPE + ':' + id;

  function createSearchableObject(rec) {
    const texts = [
      rec.filename,
      rec.data?.data?.structured_content?.map(c => c.text).join('\n'),
    ];
    const text = texts.filter(t => t).join('\n');
    return {
      id: objectId(rec.id),
      nodeLabel: 'Object',
      label: 'Document',
      type: OBJECT_TYPE,
      name: rec.filename,
      text,
      createdDateTime: rec.created,
      createdBy: rec.createdBy,
      workspaceId: String(rec.workspaceId),
      metadata: {
        filetype: rec.data?.metadata?.filetype,
      },
    };
  }

};
