import { createSlice } from '@reduxjs/toolkit';

import { http } from '../../http';

export const embeddingSlice = createSlice({
  name: 'embedding',
  initialState: {
    loaded: false,
    loading: false,
    providers: [],
  },
  reducers: {
    setProviders: (state, action) => {
      state.providers = action.payload.providers;
      state.loaded = true;
      state.loading = false;
    },
    startLoad: (state) => {
      state.loading = true;
      state.loaded = false;
    },
  },
});

export const {
  setProviders,
  startLoad,
} = embeddingSlice.actions;

export const getEmbeddingProviders = () => async (dispatch) => {
  dispatch(startLoad());
  const url = 'api/embedding-providers';
  const res = await http.get(url);
  dispatch(setProviders({ providers: res.data }));
};

export const selectLoaded = (state) => state.embedding.loaded;

export const selectLoading = (state) => state.embedding.loading;

export const selectEmbeddingProviders = (state) => state.embedding.providers;

export default embeddingSlice.reducer;
