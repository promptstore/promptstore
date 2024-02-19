import { createSlice } from '@reduxjs/toolkit';

import { http } from '../../http';

export const chunksSlice = createSlice({
  name: 'chunks',
  initialState: {
    loaded: false,
    loading: false,
    chunks: {},
  },
  reducers: {
    removeChunks: (state, action) => {
      for (const id of action.payload.ids) {
        delete state.chunks[id];
      }
    },
    resetChunks: (state) => {
      state.chunks = {};
    },
    setChunks: (state, action) => {
      for (const chunk of action.payload.chunks) {
        state.chunks[chunk.id] = chunk;
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
  removeChunks,
  resetChunks,
  setChunks,
  startLoad,
} = chunksSlice.actions;

export const getChunksAsync = ({ ids, indexName, vectorStoreProvider }) => async (dispatch) => {
  const url = `/api/index/${vectorStoreProvider}/${indexName}/chunks`;
  const res = await http.post(url, { ids });
  dispatch(setChunks({ chunks: res.data }));
};

export const selectLoaded = (state) => state.chunks.loaded;

export const selectLoading = (state) => state.chunks.loading;

export const selectChunks = (state) => state.chunks.chunks;

export default chunksSlice.reducer;
