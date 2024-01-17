import { createSlice } from '@reduxjs/toolkit';

import { http } from '../../http';

export const modelProvidersSlice = createSlice({
  name: 'modelProviders',
  initialState: {
    loaded: false,
    loading: false,
    providers: {},
  },
  reducers: {
    setProviders: (state, action) => {
      state.providers = {
        ...state.providers,
        ...action.payload,
      };
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
  setProviders,
  startLoad,
} = modelProvidersSlice.actions;

export const getEmbeddingProvidersAsync = () => async (dispatch) => {
  dispatch(startLoad());
  const url = '/api/providers/embedding';
  const res = await http.get(url);
  dispatch(setProviders({ embedding: res.data }));
};

export const getChatProvidersAsync = () => async (dispatch) => {
  dispatch(startLoad());
  const url = '/api/providers/chat';
  const res = await http.get(url);
  dispatch(setProviders({ chat: res.data }));
};

export const getCompletionProvidersAsync = () => async (dispatch) => {
  dispatch(startLoad());
  const url = '/api/providers/completion';
  const res = await http.get(url);
  dispatch(setProviders({ completion: res.data }));
};

export const selectLoaded = (state) => state.modelProviders.loaded;

export const selectLoading = (state) => state.modelProviders.loading;

export const selectProviders = (state) => state.modelProviders.providers;

export default modelProvidersSlice.reducer;
