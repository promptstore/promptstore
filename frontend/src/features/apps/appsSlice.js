import { createSlice } from '@reduxjs/toolkit';

import { http } from '../../http';

export const appsSlice = createSlice({
  name: 'apps',
  initialState: {
    apps: {},
    brief: null,
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
    setBrief: (state, action) => {
      state.brief = action.payload.brief;
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
  setBrief,
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
  dispatch(setApps({ apps: [{ ...values, id: res.data }] }));
};

export const updateAppAsync = ({ id, values }) => async (dispatch, getState) => {
  const url = `/api/apps/${id}`;
  await http.put(url, values);
  const app = getState().apps.apps[id];
  dispatch(setApps({ apps: [{ ...app, ...values, id }] }));
};

export const deleteAppsAsync = ({ ids }) => async (dispatch) => {
  const url = `/api/apps?ids=${ids.join(',')}`;
  await http.delete(url);
  dispatch(removeApps({ ids }));
};

export const generateBriefAsync = (req) => async (dispatch) => {
  dispatch(startLoadBrief());
  const url = `/api/brief`;
  const res = await http.post(url, req);
  const brief = res.data.choices[0].message.content;
  // console.log('brief:', brief);
  dispatch(setBrief({ brief }));
  // dispatch(setApps({ apps: [{ ...req.app, brief }] }));
}

export const selectLoaded = (state) => state.apps.loaded;

export const selectLoading = (state) => state.apps.loading;

export const selectLoadingBrief = (state) => state.apps.loadingBrief;

export const selectApps = (state) => state.apps.apps;

export const selectBrief = (state) => state.apps.brief;

export default appsSlice.reducer;
