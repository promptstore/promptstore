import { createSlice } from '@reduxjs/toolkit';

import { http } from '../../http';

export const hfModelsSlice = createSlice({
  name: 'hfModels',
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
} = hfModelsSlice.actions;

export const getModelsAsync = (q) => async (dispatch) => {
  dispatch(startLoad());
  const url = '/api/huggingface/models?q=' + q;
  const res = await http.get(url);
  dispatch(setModels({ models: res.data }));
};

export const selectLoaded = (state) => state.hfModels.loaded;

export const selectLoading = (state) => state.hfModels.loading;

export const selectModels = (state) => state.hfModels.models;

export default hfModelsSlice.reducer;
