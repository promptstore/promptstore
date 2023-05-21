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
      for (const key of action.payload.keys) {
        delete state.settings[key];
      }
    },
    resetSettings: (state, action) => {
      state.settings = {};
    },
    setSettings: (state, action) => {
      for (const item of action.payload.settings) {
        state.settings[item.key] = item;
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

export const getSettingAsync = ({ workspaceId, key }) => async (dispatch) => {
  dispatch(startLoad());
  const url = `/api/workspaces/${workspaceId}/settings/${key}`;
  const res = await http.get(url);
  const setting = res.data;
  dispatch(setSettings({ settings: setting ? [setting] : [] }));
};

export const createSettingAsync = ({ values }) => async (dispatch) => {
  const url = '/api/settings';
  const res = await http.post(url, values);
  dispatch(setSettings({ settings: [{ ...values, id: res.data }] }));
};

export const updateSettingAsync = ({ id, values }) => async (dispatch) => {
  const url = `/api/settings/${id}`;
  await http.put(url, values);
  dispatch(setSettings({ settings: [values] }));
};

export const deleteSettingsAsync = ({ keys }) => async (dispatch, getState) => {
  const { settings } = getState().settings;
  const ids = keys.map((key) => settings[key]?.id).filter((id) => typeof id !== 'undefined');
  if (ids.length) {
    const url = `/api/settings?ids=${ids.join(',')}`;
    await http.delete(url);
  }
  dispatch(removeSettings({ keys }));
};

export const selectLoaded = (state) => state.settings.loaded;

export const selectLoading = (state) => state.settings.loading;

export const selectSettings = (state) => state.settings.settings;

export default settingsSlice.reducer;
