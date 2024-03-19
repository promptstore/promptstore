import { createSlice } from '@reduxjs/toolkit';

import { http } from '../../http';

export const loadersSlice = createSlice({
  name: 'loaders',
  initialState: {
    loaded: false,
    loading: false,
    loaders: [],
  },
  reducers: {
    setLoaders: (state, action) => {
      state.loaders = action.payload.loaders;
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
  setLoaders,
  startLoad,
} = loadersSlice.actions;

export const getLoadersAsync = () => async (dispatch) => {
  dispatch(startLoad());
  const url = '/api/loaders';
  const res = await http.get(url);
  dispatch(setLoaders({ loaders: res.data }));
};

export const selectLoaded = (state) => state.loaders.loaded;

export const selectLoading = (state) => state.loaders.loading;

export const selectLoaders = (state) => state.loaders.loaders;

export default loadersSlice.reducer;
