import { createSlice } from '@reduxjs/toolkit';

import { http } from '../../http';

export const outputParsersSlice = createSlice({
  name: 'outputParsers',
  initialState: {
    loaded: false,
    loading: false,
    outputParsers: [],
  },
  reducers: {
    setOutputParsers: (state, action) => {
      state.outputParsers = action.payload.outputParsers;
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
  setOutputParsers,
  startLoad,
} = outputParsersSlice.actions;

export const getOutputParsersAsync = () => async (dispatch) => {
  dispatch(startLoad());
  const url = '/api/output-parsers';
  const res = await http.get(url);
  dispatch(setOutputParsers({ outputParsers: res.data }));
};

export const selectLoaded = (state) => state.outputParsers.loaded;

export const selectLoading = (state) => state.outputParsers.loading;

export const selectOutputParsers = (state) => state.outputParsers.outputParsers;

export default outputParsersSlice.reducer;
