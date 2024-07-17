import axios from 'axios';
import omit from 'lodash.omit';

import { deepDiffMapperChangesOnly, merge } from '../utils';

const CONCAT_SEP = '\n\n---\n';

const SYSTEM_WORKSPACE_ID = 1;

export default ({ app, auth, logger, services }) => {

  const {
    dataSourcesService,
    functionsService,
    indexesService,
    mirrorsService,
    modelsService,
    promptSetsService,
    secretsService,
    settingsService,
  } = services;

  app.get('/api/mirrors', auth, async (req, res) => {
    const mirrors = await mirrorsService.getMirrors();
    res.json(mirrors);
  });

  app.get('/api/mirrors/:id', auth, async (req, res) => {
    const { id } = req.params;
    const mirror = await mirrorsService.getMirror(id);
    res.json(mirror);
  });

  app.post('/api/mirrors', auth, async (req, res) => {
    const { username } = req.user;
    const values = req.body;
    const mirror = await mirrorsService.upsertMirror(values, username);
    res.json(mirror);
  });

  app.put('/api/mirrors/:id', auth, async (req, res) => {
    const { username } = req.user;
    const { id } = req.params;
    const values = req.body;
    const mirror = await mirrorsService.upsertMirror({ id, ...values }, username);
    res.json(mirror);
  });

  app.post('/api/source-workspaces', auth, async (req, res) => {
    const { serviceUrl, apiKeySecret } = req.body;
    const secret = await secretsService.getSecretByName(SYSTEM_WORKSPACE_ID, decodeURIComponent(apiKeySecret));
    const apikey = secret.value;
    const url = `${serviceUrl}/api/workspaces`;
    const resp = await axios.get(url, { headers: { apikey } });
    res.json(resp.data);
  });

  app.delete('/api/mirrors/:id', auth, async (req, res) => {
    const id = req.params.id;
    await mirrorsService.deleteMirrors([id]);
    res.json(id);
  });

  app.delete('/api/mirrors', auth, async (req, res) => {
    const ids = req.query.ids.split(',');
    await mirrorsService.deleteMirrors(ids);
    res.json(ids);
  });

  const omittedFields = ['id', 'workspaceId', 'isPublic', 'created', 'createdBy', 'modified', 'modifiedBy'];

  app.post('/api/mirror-executions', auth, async (req, res) => {
    const { mirrorId } = req.body;
    const mirror = await mirrorsService.getMirror(mirrorId);
    const maps = mirror.workspaceMapping.reduce((a, m) => {
      if (!a[m.target]) {
        a[m.target] = [];
      }
      a[m.target].push(m.source);
      return a;
    }, {});
    const secret = await secretsService.getSecretByName(SYSTEM_WORKSPACE_ID, decodeURIComponent(mirror.apiKeySecret));
    const apikey = secret.value;
    const adds = {};
    const changes = {};
    for (const [targetWorkspaceId, sourceWorkspaceIds] of Object.entries(maps)) {
      adds[targetWorkspaceId] = {};
      changes[targetWorkspaceId] = {};
      for (const sourceWorkspaceId of sourceWorkspaceIds) {
        for (const obj of mirror.objects) {
          adds[targetWorkspaceId][obj] = [];
          changes[targetWorkspaceId][obj] = [];
          const url = `${mirror.serviceUrl}/api/workspaces/${sourceWorkspaceId}/${obj}`;
          const resp = await axios.get(url, { headers: { apikey } });
          for (const source of resp.data) {
            let sourceValue = omit(source, omittedFields);
            if (obj === 'prompt-sets') {
              const ps = await promptSetsService.getPromptSetsBySkill(targetWorkspaceId, sourceValue.skill);
              if (ps.length) {
                const target = ps[0];
                const targetValue = omit(target, omittedFields);
                const diff = deepDiffMapperChangesOnly.map(targetValue, sourceValue);
                if (diff) {
                  changes[targetWorkspaceId][obj].push({
                    source,
                    target,
                    diff,
                    ...merge(target, source, diff),
                  });
                }
              } else {
                adds[targetWorkspaceId][obj].push(sourceValue);
              }
            } else if (obj === 'models') {
              const target = await modelsService.getModelByKey(targetWorkspaceId, sourceValue.key);
              if (target) {
                const targetValue = omit(target, omittedFields);
                const diff = deepDiffMapperChangesOnly.map(targetValue, sourceValue);
                if (diff) {
                  changes[targetWorkspaceId][obj].push({
                    source,
                    target,
                    diff,
                    ...merge(target, source, diff),
                  });
                }
              } else {
                adds[targetWorkspaceId][obj].push(sourceValue);
              }
            } else if (obj === 'data-sources') {
              const target = await dataSourcesService.getDataSourceByName(targetWorkspaceId, sourceValue.name);
              if (target) {
                const targetValue = omit(target, omittedFields);
                const diff = deepDiffMapperChangesOnly.map(targetValue, sourceValue);
                if (diff) {
                  changes[targetWorkspaceId][obj].push({
                    source,
                    target,
                    diff,
                    ...merge(target, source, diff),
                  });
                }
              } else {
                adds[targetWorkspaceId][obj].push(sourceValue);
              }
            } else if (obj === 'indexes') {
              const target = await indexesService.getIndexByKey(targetWorkspaceId, sourceValue.key);
              if (target) {
                const targetValue = omit(target, omittedFields);
                const diff = deepDiffMapperChangesOnly.map(targetValue, sourceValue);
                if (diff) {
                  changes[targetWorkspaceId][obj].push({
                    source,
                    target,
                    diff,
                    ...merge(target, source, diff),
                  });
                }
              } else {
                adds[targetWorkspaceId][obj].push(sourceValue);
              }
            } else if (obj === 'functions') {
              const implementations = await buildImplementations(mirror, apikey, targetWorkspaceId, sourceValue, true);
              sourceValue = { ...sourceValue, implementations };
              const updatedSource = { ...source, implementations };
              const target = await functionsService.getFunctionByName(targetWorkspaceId, sourceValue.name);
              if (target) {
                const targetValue = omit(target, omittedFields);
                const diff = deepDiffMapperChangesOnly.map(targetValue, sourceValue);
                if (diff) {
                  changes[targetWorkspaceId][obj].push({
                    source: updatedSource,
                    target,
                    diff,
                    ...merge(target, updatedSource, diff),
                  });
                }
              } else {
                adds[targetWorkspaceId][obj].push(sourceValue);
              }
            }
          }
        }
      }
    }
    res.json({
      adds,
      changes,
    });
  });

  const buildImplementations = async (mirror, apikey, targetWorkspaceId, sourceValue, dryRun) => {
    let u;
    let r;
    let sourcePromptSet;
    let pss;
    let ps;
    let newPromptSet;
    let sourceModel;
    let model;
    let newModel;
    let sourceRerankerModel;
    let rerankerModel;
    let newRerankerModel;
    let sourceDataSource;
    let ds;
    let newDataSource;
    let sourceIndex;
    let index;
    let newIndex;
    const implementations = [];
    for (const impl of (sourceValue.implementations || [])) {
      let targetPromptSetId;
      let targetModelId;
      let targetRerankerModelId;
      let targetSqlSourceId;
      let targetDataSourceId;
      let targetGraphSourceId;

      const sourcePromptSetId = impl.promptSetId;
      if (sourcePromptSetId) {
        u = `${mirror.serviceUrl}/api/prompt-sets/${sourcePromptSetId}`;
        r = await axios.get(u, { headers: { apikey } });
        sourcePromptSet = r.data;
        if (sourcePromptSet) {
          pss = await promptSetsService.getPromptSetsByName(targetWorkspaceId, sourcePromptSet.name);
          if (pss.length) {
            ps = pss[0];
          } else {
            newPromptSet = omit(sourcePromptSet, omittedFields);
            if (dryRun) {
              ps = { id: 123 };
            } else {
              ps = await promptSetsService.upsertPromptSet(newPromptSet, username);
            }
          }
          targetPromptSetId = ps.id;
        }
      }

      const sourceModelId = impl.modelId;
      if (sourceModelId) {
        u = `${mirror.serviceUrl}/api/models/${sourceModelId}`;
        r = await axios.get(u, { headers: { apikey } });
        sourceModel = r.data;
        if (sourceModel) {
          model = await modelsService.getModelByKey(targetWorkspaceId, sourceModel.key);
          if (!model) {
            newModel = omit(sourceModel, omittedFields);
            if (dryRun) {
              model = { id: 123 };
            } else {
              model = await modelsService.upsertModel(newModel, username);
            }
          }
          targetModelId = model.id;
        }
      }

      const sourceRerankerModelId = impl.rerankerModelId;
      if (sourceRerankerModelId) {
        u = `${mirror.serviceUrl}/api/models/${sourceRerankerModelId}`;
        r = await axios.get(u, { headers: { apikey } });
        sourceRerankerModel = r.data;
        if (sourceRerankerModel) {
          rerankerModel = await modelsService.getModelByKey(targetWorkspaceId, sourceRerankerModel.key);
          if (!rerankerModel) {
            newRerankerModel = omit(sourceRerankerModel, omittedFields);
            if (dryRun) {
              rerankerModel = { id: 123 };
            } else {
              rerankerModel = await modelsService.upsertModel(newRerankerModel, username);
            }
          }
          targetRerankerModelId = rerankerModel.id;
        }
      }

      const sourceSqlSourceId = impl.sqlSourceId;
      if (sourceSqlSourceId) {
        u = `${mirror.serviceUrl}/api/data-sources/${sourceSqlSourceId}`;
        r = await axios.get(u, { headers: { apikey } });
        sourceDataSource = r.data;
        if (sourceDataSource) {
          ds = await dataSourcesService.getDataSourceByName(targetWorkspaceId, sourceDataSource.name);
          if (!ds) {
            newDataSource = omit(sourceDataSource, omittedFields);
            if (dryRun) {
              ds = { id: 123 };
            } else {
              ds = await dataSourcesService.upsertDataSource(newDataSource, username);
            }
          }
          targetSqlSourceId = ds.id;
        }
      }

      // Online feature store
      const sourceDataSourceId = impl.dataSourceId;
      if (sourceDataSourceId) {
        u = `${mirror.serviceUrl}/api/data-sources/${sourceDataSourceId}`;
        r = await axios.get(u, { headers: { apikey } });
        sourceDataSource = r.data;
        if (sourceDataSource) {
          ds = await dataSourcesService.getDataSourceByName(targetWorkspaceId, sourceDataSource.name);
          if (!ds) {
            newDataSource = omit(sourceDataSource, omittedFields);
            if (dryRun) {
              ds = { id: 123 };
            } else {
              ds = await dataSourcesService.upsertDataSource(newDataSource, username);
            }
          }
          targetDataSourceId = ds.id;
        }
      }

      const sourceGraphSourceId = impl.graphSourceId;
      if (sourceGraphSourceId) {
        u = `${mirror.serviceUrl}/api/data-sources/${sourceGraphSourceId}`;
        r = await axios.get(u, { headers: { apikey } });
        sourceDataSource = r.data;
        if (sourceDataSource) {
          ds = await dataSourcesService.getDataSourceByName(targetWorkspaceId, sourceDataSource.name);
          if (!ds) {
            newDataSource = omit(sourceDataSource, omittedFields);
            if (dryRun) {
              ds = { id: 123 };
            } else {
              ds = await dataSourcesService.upsertDataSource(newDataSource, username);
            }
          }
          targetGraphSourceId = ds.id;
        }
      }

      const indexes = [];
      for (const sourceIndexInfo of (impl.indexes || [])) {
        const sourceIndexId = sourceIndexInfo.indexId;
        if (sourceIndexId) {
          u = `${mirror.serviceUrl}/api/indexes/${sourceIndexId}`;
          r = await axios.get(u, { headers: { apikey } });
          sourceIndex = r.data;
          if (sourceIndex) {
            index = await indexesService.getIndexByKey(targetWorkspaceId, sourceIndex.key);
            if (!index) {
              newIndex = omit(sourceIndex, omittedFields);
              if (dryRun) {
                index = { id: 123 };
              } else {
                index = await indexesService.upsertIndex(newIndex, username);
              }
            }
            indexes.push({ ...sourceIndexInfo, indexId: index.id });
          }
        }
      }

      implementations.push({
        ...impl,
        promptSetId: targetPromptSetId,
        modelId: targetModelId,
        rerankerModelId: targetRerankerModelId,
        dataSourceId: targetDataSourceId,
        sqlSourceId: targetSqlSourceId,
        graphSourceId: targetGraphSourceId,
        indexes,
      });
    }
    return implementations;
  }

  app.post('/api/mirror-executions/confirm', auth, async (req, res) => {
    const { username } = req.body;
    const { mirrorId, conflictActions, dryRun } = req.body;
    const actions = {};
    for (const [k, v] of Object.entries(conflictActions)) {
      const [targetId, path] = k.split(':');
      if (!actions[targetId]) {
        actions[targetId] = {};
      }
      actions[targetId][path] = v;
    }
    const mirror = await mirrorsService.getMirror(mirrorId);
    const maps = mirror.workspaceMapping.reduce((a, m) => {
      if (!a[m.target]) {
        a[m.target] = [];
      }
      a[m.target].push(m.source);
      return a;
    }, {});
    const secret = await secretsService.getSecretByName(SYSTEM_WORKSPACE_ID, decodeURIComponent(mirror.apiKeySecret));
    const apikey = secret.value;
    const adds = {};
    const changes = {};
    const newPromptSetTags = {};
    const newFunctionTags = {};
    for (const [targetWorkspaceId, sourceWorkspaceIds] of Object.entries(maps)) {
      adds[targetWorkspaceId] = {};
      changes[targetWorkspaceId] = {};
      for (const sourceWorkspaceId of sourceWorkspaceIds) {
        for (const obj of mirror.objects) {
          adds[targetWorkspaceId][obj] = [];
          changes[targetWorkspaceId][obj] = [];
          const url = `${mirror.serviceUrl}/api/workspaces/${sourceWorkspaceId}/${obj}`;
          const resp = await axios.get(url, { headers: { apikey } });
          for (const source of resp.data) {
            let sourceValue = omit(source, omittedFields);
            if (obj === 'prompt-sets') {
              const ps = await promptSetsService.getPromptSetsBySkill(targetWorkspaceId, sourceValue.skill);
              if (ps.length) {
                const target = ps[0];
                const targetValue = omit(target, omittedFields);
                const diff = deepDiffMapperChangesOnly.map(targetValue, sourceValue);
                if (diff) {
                  const { merged } = merge(target, source, diff, actions[target.id]);
                  const newDiff = deepDiffMapperChangesOnly.map(merged, target);
                  if (!newPromptSetTags[targetWorkspaceId]) {
                    newPromptSetTags[targetWorkspaceId] = [];
                  }
                  newPromptSetTags[targetWorkspaceId].push(...(merged.tags || []));
                  changes[targetWorkspaceId][obj].push({
                    source: merged,
                    target,
                    diff,
                    ...merge(target, merged, newDiff || {}),
                  });
                  if (!dryRun) {
                    promptSetsService.upsertPromptSet(merged, username);
                  }
                }
              } else {
                if (!newPromptSetTags[targetWorkspaceId]) {
                  newPromptSetTags[targetWorkspaceId] = [];
                }
                newPromptSetTags[targetWorkspaceId].push(...(sourceValue.tags || []));
                const value = {
                  ...sourceValue,
                  workspaceId: targetWorkspaceId,
                };
                adds[targetWorkspaceId][obj].push(value);
                if (!dryRun) {
                  promptSetsService.upsertPromptSet(value, username);
                }
              }
            } else if (obj === 'models') {
              const target = await modelsService.getModelByKey(targetWorkspaceId, sourceValue.key);
              if (target) {
                const targetValue = omit(target, omittedFields);
                const diff = deepDiffMapperChangesOnly.map(targetValue, sourceValue);
                if (diff) {
                  const { merged } = merge(target, source, diff, actions[target.id]);
                  const newDiff = deepDiffMapperChangesOnly.map(merged, target);
                  changes[targetWorkspaceId][obj].push({
                    source: merged,
                    target,
                    diff,
                    ...merge(target, merged, newDiff || {}),
                  });
                  if (!dryRun) {
                    modelsService.upsertModel(merged, username);
                  }
                }
              } else {
                const value = {
                  ...sourceValue,
                  workspaceId: targetWorkspaceId,
                };
                adds[targetWorkspaceId][obj].push(value);
                if (!dryRun) {
                  modelsService.upsertModel(value, username);
                }
              }
            } else if (obj === 'data-sources') {
              const target = await dataSourcesService.getDataSourceByName(targetWorkspaceId, sourceValue.name);
              if (target) {
                const targetValue = omit(target, omittedFields);
                const diff = deepDiffMapperChangesOnly.map(targetValue, sourceValue);
                if (diff) {
                  const { merged } = merge(target, source, diff, actions[target.id]);
                  const newDiff = deepDiffMapperChangesOnly.map(merged, target);
                  changes[targetWorkspaceId][obj].push({
                    source: merged,
                    target,
                    diff,
                    ...merge(target, merged, newDiff || {}),
                  });
                  if (!dryRun) {
                    dataSourcesService.upsertDataSource(merged, username);
                  }
                }
              } else {
                const value = {
                  ...sourceValue,
                  workspaceId: targetWorkspaceId,
                };
                adds[targetWorkspaceId][obj].push(value);
                if (!dryRun) {
                  dataSourcesService.upsertDataSource(value, username);
                }
              }
            } else if (obj === 'indexes') {
              const target = await indexesService.getIndexByKey(targetWorkspaceId, sourceValue.key);
              if (target) {
                const targetValue = omit(target, omittedFields);
                const diff = deepDiffMapperChangesOnly.map(targetValue, sourceValue);
                if (diff) {
                  const { merged } = merge(target, source, diff, actions[target.id]);
                  const newDiff = deepDiffMapperChangesOnly.map(merged, target);
                  changes[targetWorkspaceId][obj].push({
                    source: merged,
                    target,
                    diff,
                    ...merge(target, merged, newDiff || {}),
                  });
                  if (!dryRun) {
                    indexesService.upsertIndex(merged, username);
                  }
                }
              } else {
                const value = {
                  ...sourceValue,
                  workspaceId: targetWorkspaceId,
                };
                adds[targetWorkspaceId][obj].push(value);
                if (!dryRun) {
                  indexesService.upsertIndex(value, username);
                }
              }
            } else if (obj === 'functions') {
              const implementations = await buildImplementations(mirror, apikey, targetWorkspaceId, sourceValue, dryRun);
              sourceValue = { ...sourceValue, implementations };
              const updatedSource = { ...source, implementations };
              const target = await functionsService.getFunctionByName(targetWorkspaceId, sourceValue.name);
              if (target) {
                const targetValue = omit(target, omittedFields);
                const diff = deepDiffMapperChangesOnly.map(targetValue, sourceValue);
                if (diff) {
                  const { merged } = merge(target, updatedSource, diff, actions[target.id]);
                  const newDiff = deepDiffMapperChangesOnly.map(merged, target);
                  if (!newFunctionTags[targetWorkspaceId]) {
                    newFunctionTags[targetWorkspaceId] = [];
                  }
                  newFunctionTags[targetWorkspaceId].push(...(merged.tags || []));
                  changes[targetWorkspaceId][obj].push({
                    source: merged,
                    target,
                    diff,
                    ...merge(target, merged, newDiff || {}),
                  });
                  if (!dryRun) {
                    modelsService.upsertModel(merged, username);
                  }
                }
              } else {
                if (!newFunctionTags[targetWorkspaceId]) {
                  newFunctionTags[targetWorkspaceId] = [];
                }
                newFunctionTags[targetWorkspaceId].push(...(sourceValue.tags || []));
                const value = {
                  ...sourceValue,
                  workspaceId: targetWorkspaceId,
                };
                adds[targetWorkspaceId][obj].push(value);
                if (!dryRun) {
                  modelsService.upsertModel(value, username);
                }
              }
            }
          }
        }
      }
    }
    for (const [k, v] of Object.entries(newPromptSetTags)) {
      const tagsSetting = await settingsService.getSettingsByKey(k, 'promptSetTags');
      let value = [...v];
      if (tagsSetting) {
        value.push(...(tagsSetting.value || []));
        value = [...new Set(value)];
        value.sort((a, b) => a < b ? -1 : 1);
        if (!dryRun) {
          await settingsService.upsertSetting({ ...tagsSetting, value }, username);
        }
      } else {
        value = [...new Set(value)];
        value.sort((a, b) => a < b ? -1 : 1);
        if (!dryRun) {
          await settingsService.upsertSetting({
            workspaceId: k,
            key: 'promptSetTags',
            value,
          }, username);
        }
      }
    }
    for (const [k, v] of Object.entries(newFunctionTags)) {
      const tagsSetting = await settingsService.getSettingsByKey(k, 'functionTags');
      let value = [...v];
      if (tagsSetting) {
        value.push(...(tagsSetting.value || []));
        value = [...new Set(value)];
        value.sort((a, b) => a < b ? -1 : 1);
        if (!dryRun) {
          await settingsService.upsertSetting({ ...tagsSetting, value }, username);
        }
      } else {
        value = [...new Set(value)];
        value.sort((a, b) => a < b ? -1 : 1);
        if (!dryRun) {
          await settingsService.upsertSetting({
            workspaceId: k,
            key: 'functionTags',
            settingType: 'json',
            value,
          }, username);
        }
      }
    }
    res.json({
      adds,
      changes,
    });
  });

};
