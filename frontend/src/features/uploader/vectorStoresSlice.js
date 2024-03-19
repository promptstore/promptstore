import { createSlice } from '@reduxjs/toolkit';

import { http } from '../../http';

export const vectorStoresSlice = createSlice({
  name: 'vectorStores',
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
} = vectorStoresSlice.actions;

export const getVectorStoresAsync = () => async (dispatch) => {
  dispatch(startLoad());
  const url = '/api/vector-stores';
  const res = await http.get(url);
  dispatch(setProviders({ providers: res.data }));
};

export const selectLoaded = (state) => state.vectorStores.loaded;

export const selectLoading = (state) => state.vectorStores.loading;

export const selectVectorStores = (state) => state.vectorStores.providers;

export default vectorStoresSlice.reducer;
