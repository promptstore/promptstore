import { createSlice } from '@reduxjs/toolkit';

import { http } from '../../http';

export const dataSourcesSlice = createSlice({
  name: 'dataSources',
  initialState: {
    loaded: false,
    loading: false,
    dataSources: {},
  },
  reducers: {
    removeDataSources: (state, action) => {
      for (const id of action.payload.ids) {
        delete state.dataSources[id];
      }
    },
    setDataSources: (state, action) => {
      for (const ds of action.payload.dataSources) {
        state.dataSources[ds.id] = ds;
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
  removeDataSources,
  setDataSources,
  startLoad,
} = dataSourcesSlice.actions;

export const getDataSourcesAsync = (params) => async (dispatch) => {
  dispatch(startLoad());
  let url = '/api/data-sources';
  if (params?.type) {
    url += '?type=' + params.type;
  }
  const res = await http.get(url);
  dispatch(setDataSources({ dataSources: res.data }));
};

export const getDataSourceAsync = (id) => async (dispatch) => {
  dispatch(startLoad());
  const url = `/api/data-sources/${id}`;
  const res = await http.get(url);
  dispatch(setDataSources({ dataSources: [res.data] }));
};

const getNewDataSources = (current, id, content) => {
  if (!current) return null;
  const index = current.findIndex((ds) => ds.id === id);
  if (index === -1) {
    return null;
  }
  const ds = current[index];
  const dataSources = [...current];
  dataSources.splice(index, 1, { ...ds, content });
  return dataSources;
};

export const getDataSourceContentAsync = (id, maxBytes) => async (dispatch, getState) => {
  const { dataSources } = getState().dataSources;
  dispatch(startLoad());
  let url = `/api/data-sources/${id}/content`;
  if (maxBytes) {
    url += `?maxBytes=${maxBytes}`;
  }
  const res = await http.get(url);
  const content = res.data;
  const newDataSources = getNewDataSources(Object.values(dataSources), id, content);
  dispatch(setDataSources({ dataSources: newDataSources }));
};

export const createDataSourceAsync = ({ values }) => async (dispatch) => {
  const url = '/api/data-sources';
  const res = await http.post(url, values);
  const ds = { ...values, id: res.data };
  dispatch(setDataSources({ dataSources: [ds] }));
};

export const updateDataSourceAsync = ({ id, values }) => async (dispatch) => {
  const url = `/api/data-sources/${id}`;
  await http.put(url, values);
  dispatch(setDataSources({ dataSources: [{ ...values, id }] }));
};

export const deleteDataSourcesAsync = ({ ids }) => async (dispatch) => {
  const url = `/api/data-sources?ids=${ids.join(',')}`;
  await http.delete(url);
  dispatch(removeDataSources({ ids }));
};

export const crawlAsync = ({ url, spec, maxRequestsPerCrawl, indexId, newIndexName, engine, titleField, vectorField }) => async (dispatch) => {
  await http.post('/api/crawls', { url, spec, maxRequestsPerCrawl, indexId, newIndexName, engine, titleField, vectorField });
};

export const selectLoaded = (state) => state.dataSources.loaded;

export const selectLoading = (state) => state.dataSources.loading;

export const selectDataSources = (state) => state.dataSources.dataSources;

export default dataSourcesSlice.reducer;
