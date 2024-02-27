import { createSlice } from '@reduxjs/toolkit';

import { http } from '../../http';
import { runWithMinDelay } from '../../utils';

export const modelsSlice = createSlice({
  name: 'models',
  initialState: {
    loaded: false,
    loading: false,
    models: {},
  },
  reducers: {
    removeModels: (state, action) => {
      for (const id of action.payload.ids) {
        delete state.models[id];
      }
    },
    setModels: (state, action) => {
      for (const model of action.payload.models) {
        state.models[model.id] = model;
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
  removeModels,
  setModels,
  startLoad,
} = modelsSlice.actions;

export const getModelsAsync = ({ workspaceId, minDelay, type }) => async (dispatch) => {
  dispatch(startLoad());
  let url = `/api/workspaces/${workspaceId}/models`;
  if (type) {
    url += '?type=' + type;
  }
  const startTime = new Date();
  const res = await http.get(url);
  runWithMinDelay(startTime, minDelay, () => {
    dispatch(setModels({ models: res.data }));
  });
};

export const getModelAsync = (id) => async (dispatch) => {
  dispatch(startLoad());
  const url = `/api/models/${id}`;
  const res = await http.get(url);
  dispatch(setModels({ models: [res.data] }));
};

export const getModelByKeyAsync = ({ key, workspaceId }) => async (dispatch) => {
  dispatch(startLoad());
  const url = `/api/workspaces/${workspaceId}/models-by-key/${key}`;
  const res = await http.get(url);
  dispatch(setModels({ models: [res.data] }));
};

export const createModelAsync = ({ values }) => async (dispatch) => {
  const url = '/api/models';
  const res = await http.post(url, values);
  dispatch(setModels({ models: [res.data] }));
};

export const updateModelAsync = ({ id, values }) => async (dispatch) => {
  const url = `/api/models/${id}`;
  const res = await http.put(url, values);
  dispatch(setModels({ models: [res.data] }));
};

export const deleteModelsAsync = ({ ids }) => async (dispatch) => {
  const url = `/api/models?ids=${ids.join(',')}`;
  await http.delete(url);
  dispatch(removeModels({ ids }));
};

export const selectLoaded = (state) => state.models.loaded;

export const selectLoading = (state) => state.models.loading;

export const selectModels = (state) => state.models.models;

export default modelsSlice.reducer;
