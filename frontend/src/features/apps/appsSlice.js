import { createSlice } from '@reduxjs/toolkit';

import { http } from '../../http';

export const appsSlice = createSlice({
  name: 'apps',
  initialState: {
    apps: {},
    loaded: false,
    loading: false,
    loadingBrief: false,
  },
  reducers: {
    removeApps: (state, action) => {
      for (const id of action.payload.ids) {
        delete state.apps[id];
      }
    },
    resetApps: (state, action) => {
      state.apps = {};
    },
    setApps: (state, action) => {
      for (const app of action.payload.apps) {
        state.apps[app.id] = app;
      }
      state.loaded = true;
      state.loading = false;
      state.loadingBrief = false;
    },
    startLoad: (state) => {
      state.loaded = false;
      state.loading = true;
    },
    startLoadBrief: (state) => {
      state.loadingBrief = true;
    }
  }
});

export const {
  removeApps,
  resetApps,
  setApps,
  startLoad,
  startLoadBrief,
} = appsSlice.actions;

export const getAppsAsync = ({ workspaceId }) => async (dispatch) => {
  dispatch(startLoad());
  dispatch(resetApps());
  const url = `/api/workspaces/${workspaceId}/apps`;
  const res = await http.get(url);
  dispatch(setApps({ apps: res.data }));
};

export const getAppAsync = (id) => async (dispatch) => {
  dispatch(startLoad());
  const url = `/api/apps/${id}`;
  const res = await http.get(url);
  dispatch(setApps({ apps: [res.data] }));
};

export const createAppAsync = ({ values }) => async (dispatch) => {
  const url = '/api/apps';
  const res = await http.post(url, values);
  dispatch(setApps({ apps: [res.data] }));
};

export const updateAppAsync = ({ id, values }) => async (dispatch) => {
  const url = `/api/apps/${id}`;
  const res = await http.put(url, values);
  dispatch(setApps({ apps: [res.data] }));
};

export const deleteAppsAsync = ({ ids }) => async (dispatch) => {
  const url = `/api/apps?ids=${ids.join(',')}`;
  await http.delete(url);
  dispatch(removeApps({ ids }));
};

export const selectLoaded = (state) => state.apps.loaded;

export const selectLoading = (state) => state.apps.loading;

export const selectLoadingBrief = (state) => state.apps.loadingBrief;

export const selectApps = (state) => state.apps.apps;

export default appsSlice.reducer;
