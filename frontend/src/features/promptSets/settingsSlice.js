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

export const getSettingsAsync = ({ workspaceId, key }) => async (dispatch) => {
  dispatch(startLoad());
  const url = `/api/workspaces/${workspaceId}/settings/${key}`;
  const res = await http.get(url);
  dispatch(setSettings({ settings: res.data }));
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

export const deleteSettingsAsync = ({ ids }) => async (dispatch, getState) => {
  const { settings } = getState().settings;
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
