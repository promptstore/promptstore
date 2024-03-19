import { createSlice } from '@reduxjs/toolkit';

import { http } from '../../http';

export const extractorsSlice = createSlice({
  name: 'extractors',
  initialState: {
    loaded: false,
    loading: false,
    extractors: [],
  },
  reducers: {
    setExtractors: (state, action) => {
      state.extractors = action.payload.extractors;
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
  setExtractors,
  startLoad,
} = extractorsSlice.actions;

export const getExtractorsAsync = () => async (dispatch) => {
  dispatch(startLoad());
  const url = '/api/extractors';
  const res = await http.get(url);
  dispatch(setExtractors({ extractors: res.data }));
};

export const selectLoaded = (state) => state.extractors.loaded;

export const selectLoading = (state) => state.extractors.loading;

export const selectExtractors = (state) => state.extractors.extractors;

export default extractorsSlice.reducer;
