import { createSlice } from '@reduxjs/toolkit';

import { http } from '../../http';

export const settingsSlice = createSlice({
  name: 'settings',
  initialState: {
    loaded: false,
    loading: false,
    settings: {},
  },
  reducers: {
    removeSettings: (state, action) => {
      for (const id of action.payload.ids) {
        delete state.settings[id];
      }
    },
    resetSettings: (state, action) => {
      state.settings = {};
    },
    setSettings: (state, action) => {
      for (const item of action.payload.settings) {
        state.settings[item.id] = item;
      }
      state.loaded = true;
      state.loading = false;
    },
    startLoad: (state) => {
      state.loaded = false;
      state.loading = true;
    },
  }
});

export const {
  removeSettings,
  resetSettings,
  setSettings,
  startLoad,
} = settingsSlice.actions;

export const getSettingsAsync = ({ workspaceId, keys }) => async (dispatch) => {
  dispatch(startLoad());
  dispatch(resetSettings());
  let url = `/api/workspaces/${workspaceId}/settings`;
  if (keys) {
    url += '?keys=' + keys.join(',');
  }
  const res = await http.get(url);
  const settings = res.data;
  dispatch(setSettings({ settings }));
};

export const getSettingAsync = (id) => async (dispatch) => {
  dispatch(startLoad());
  const url = `/api/settings-by-id/${id}`;
  const res = await http.get(url);
  const setting = res.data;
  dispatch(setSettings({ settings: setting ? [setting] : [] }));
};

export const getSettingByKeyAsync = (workspaceId, key) => async (dispatch) => {
  dispatch(startLoad());
  const url = `/api/workspaces/${workspaceId}/settings/${key}`;
  const res = await http.get(url);
  const settings = res.data;
  dispatch(setSettings({ settings }));
};

export const createSettingAsync = ({ values }) => async (dispatch) => {
  const url = '/api/settings';
  const res = await http.post(url, values);
  dispatch(setSettings({ settings: [res.data] }));
};

export const updateSettingAsync = ({ id, values }) => async (dispatch) => {
  const url = `/api/settings/${id}`;
  const res = await http.put(url, values);
  dispatch(setSettings({ settings: [res.data] }));
};

export const deleteSettingsAsync = ({ ids }) => async (dispatch, getState) => {
  if (ids.length) {
    const url = `/api/settings?ids=${ids.join(',')}`;
    await http.delete(url);
  }
  dispatch(removeSettings({ ids }));
};

export const selectLoaded = (state) => state.settings.loaded;

export const selectLoading = (state) => state.settings.loading;

export const selectSettings = (state) => state.settings.settings;

export default settingsSlice.reducer;
