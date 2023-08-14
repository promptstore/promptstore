import { createSlice } from '@reduxjs/toolkit';

import { http } from '../../http';

export const indexesSlice = createSlice({
  name: 'indexes',
  initialState: {
    loaded: false,
    loading: false,
    indexes: {},
  },
  reducers: {
    removeIndexes: (state, action) => {
      for (const id of action.payload.ids) {
        delete state.indexes[id];
      }
    },
    resetIndexes: (state) => {
      state.indexes = {};
    },
    setIndexes: (state, action) => {
      for (const index of action.payload.indexes) {
        state.indexes[index.id] = index;
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
  removeIndexes,
  resetIndexes,
  setIndexes,
  startLoad,
} = indexesSlice.actions;

export const getIndexesAsync = ({ workspaceId }) => async (dispatch) => {
  dispatch(startLoad());
  dispatch(resetIndexes());
  const url = `/api/workspaces/${workspaceId}/indexes`;
  const res = await http.get(url);
  dispatch(setIndexes({ indexes: res.data }));
};

export const getIndexAsync = (id) => async (dispatch) => {
  dispatch(startLoad());
  const url = `/api/indexes/${id}`;
  const res = await http.get(url);
  const { name } = res.data;
  let index;
  try {
    const res1 = await http.get(`/api/index/idx:${name}`);
    // console.log('res1:', res1.data);
    const {
      attributes,
      numDocs,
      numRecords,
      numTerms,
      recordsPerDocAvg,
    } = res1.data;
    index = {
      ...res.data,
      store: {
        attributes,
        numDocs,
        numRecords,
        numTerms,
        recordsPerDocAvg,
      },
    };
  } catch (err) {
    // index probably doesn't exist
    index = res.data;
  }
  dispatch(setIndexes({ indexes: [index] }));
};

export const createIndexAsync = ({ values }) => async (dispatch) => {
  const url = '/api/indexes';
  const res = await http.post(url, values);
  const index = { ...res.data, store: null };
  dispatch(setIndexes({ indexes: [index] }));
};

export const updateIndexAsync = ({ id, values }) => async (dispatch) => {
  const url = `/api/indexes/${id}`;
  const res = await http.put(url, values);
  dispatch(setIndexes({ indexes: [{ ...res.data, store: null }] }));
};

export const deleteIndexesAsync = ({ ids }) => async (dispatch) => {
  const url = `/api/indexes?ids=${ids.join(',')}`;
  await http.delete(url);
  dispatch(removeIndexes({ ids }));
};

export const createPhysicalIndexAsync = ({ id, name, schema }) => async (dispatch, getState) => {
  const indexes = getState().indexes.indexes;
  const currentIndex = indexes[id];
  const url = `/api/index`;
  const res = await http.post(url, { indexName: name, schema });
  const index = { ...currentIndex, store: res.data };
  dispatch(setIndexes({ indexes: [index] }));
};

export const dropPhysicalIndexAsync = ({ id, name }) => async (dispatch, getState) => {
  const indexes = getState().indexes.indexes;
  const currentIndex = indexes[id];
  const url = `/api/index/idx:${name}`;
  await http.delete(url);
  const index = { ...currentIndex, store: null };
  dispatch(setIndexes({ indexes: [index] }));
};

export const dropDataAsync = ({ name }) => async () => {
  const url = `/api/index/${name}/data`;
  await http.delete(url);
};

export const selectLoaded = (state) => state.indexes.loaded;

export const selectLoading = (state) => state.indexes.loading;

export const selectIndexes = (state) => state.indexes.indexes;

export default indexesSlice.reducer;
