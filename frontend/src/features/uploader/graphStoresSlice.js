import { createSlice } from '@reduxjs/toolkit';

import { http } from '../../http';

export const graphStoresSlice = createSlice({
  name: 'graphStores',
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
} = graphStoresSlice.actions;

export const getGraphStores = () => async (dispatch) => {
  dispatch(startLoad());
  const url = '/api/graph-stores';
  const res = await http.get(url);
  dispatch(setProviders({ providers: res.data }));
};

export const selectLoaded = (state) => state.graphStores.loaded;

export const selectLoading = (state) => state.graphStores.loading;

export const selectGraphStores = (state) => state.graphStores.providers;

export default graphStoresSlice.reducer;
