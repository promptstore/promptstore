import isObject from 'lodash.isobject';
import merge from 'lodash.merge';

export default ({ app, auth, constants, logger, services }) => {

  const { settingsService } = services;

  const mergeValue = (type, s1, s2) => {
    const s = s1 || s2;
    if (s) {
      if (type === 'string' || type === 'number') {
        if (s1 && s2) {
          return { value: s1.value || s2.value };
        }
        return { value: s.value };
      }
      if (type === 'options') {
        if (s1 && s2) {
          let options = [...(s1.options || []), ...(s2.options || [])];
          options = options.reduce((a, o) => {
            if (!a.find(x => x.value === o.value)) {
              a.push(o);
            }
            return a;
          }, []);
          return { options };
        }
        return { options: s.options };
      }
      if (type === 'json') {
        if (s1 && s2) {
          if (Array.isArray(s1.value || s2.value)) {
            let value = [...(s1.value || []), ...(s2.value || [])];
            value = value.reduce((a, v) => {
              if (!a.includes(v)) {
                a.push(v);
              }
              return a;
            }, []);
            return { value };
          }
          if (isObject(s1.value || s2.value)) {
            return { value: merge(s1.value, s2.value) };
          }
        }
      }
      return { value: s.value };
    }
    return {};
  };

  app.get('/api/workspaces/:workspaceId/settings', auth, async (req, res, next) => {
    const { workspaceId } = req.params;
    const { keys } = req.query;
    logger.debug('keys:', keys);
    let settings, systemSettings;
    if (keys) {
      const keysList = keys.split(',');
      settings = await settingsService.getSettingsByKeys(workspaceId, keysList);
      systemSettings = await settingsService.getSettingsByKeys(constants.SYSTEM_WORKSPACE_ID, keysList);
    } else {
      settings = await settingsService.getSettings(workspaceId);
      systemSettings = await settingsService.getSettings(constants.SYSTEM_WORKSPACE_ID);
    }
    const settingsByKey = settings.reduce((a, s) => {
      a[s.key] = s;
      return a;
    }, {});
    const systemSettingsByKey = systemSettings.reduce((a, s) => {
      a[s.key] = s;
      return a;
    }, {});
    const keysList = [...new Set([...Object.keys(settingsByKey), ...Object.keys(systemSettingsByKey)])];
    const combined = [];
    for (const key of keysList) {
      const s1 = settingsByKey[key];
      const s2 = systemSettingsByKey[key];
      const s = s1 || s2;
      if (s) {
        if (s1 && s2) {
          const value = mergeValue(s.type, s1, s2);
          combined.push({ ...s, ...value });
        }
        combined.push(s);
      }
    }
    res.json(combined);
  });

  app.get('/api/workspaces/:workspaceId/settings/:key', auth, async (req, res, next) => {
    const { workspaceId, key } = req.params;
    logger.debug('key:', key);
    let s1, s2;
    const settings = await settingsService.getSettingsByKey(workspaceId, key);
    if (settings.length) {
      s1 = settings[0];
    }
    const systemSettings = await settingsService.getSettingsByKey(constants.SYSTEM_WORKSPACE_ID, key);
    if (systemSettings.length) {
      s2 = systemSettings[0];
    }
    const s = s1 || s2;
    if (s) {
      if (s1 && s2) {
        const value = mergeValue(s.type, s1, s2);
        res.json([{ ...s, ...value }]);
      } else {
        res.json([s]);
      }
    } else {
      res.json([]);
    }
  });

  app.get('/api/settings/:key', auth, async (req, res, next) => {
    const { key } = req.params;
    logger.debug('key:', key);
    const settings = await settingsService.getSettingsByKey(null, key);
    res.json(settings);
  });

  app.get('/api/settings-by-id/:id', auth, async (req, res, next) => {
    const { id } = req.params;
    logger.debug('id:', id);
    const setting = await settingsService.getSetting(id);
    res.json(setting);
  });

  app.post('/api/settings', auth, async (req, res, next) => {
    const { username } = req.user;
    const values = req.body;
    const setting = await settingsService.upsertSetting(values, username);
    res.json(setting);
  });

  app.put('/api/settings/:id', auth, async (req, res, next) => {
    const { id } = req.params;
    const { username } = req.user;
    const values = req.body;
    const setting = await settingsService.upsertSetting({ id, ...values }, username);
    res.json(setting);
  });

  app.delete('/api/settings/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    await settingsService.deleteSettings([id]);
    res.json(id);
  });

  app.delete('/api/settings', auth, async (req, res, next) => {
    const ids = req.query.ids.split(',');
    await settingsService.deleteSettings(ids);
    res.json(ids);
  });

};
