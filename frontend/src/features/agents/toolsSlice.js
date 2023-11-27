import { createSlice } from '@reduxjs/toolkit';

import { http } from '../../http';

export const toolsSlice = createSlice({
  name: 'tools',
  initialState: {
    loaded: false,
    loading: false,
    tools: [],
  },
  reducers: {
    setTools: (state, action) => {
      state.tools = action.payload.tools;
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
  setTools,
  startLoad,
} = toolsSlice.actions;

export const getToolsAsync = () => async (dispatch) => {
  dispatch(startLoad());
  const url = '/api/tools';
  const res = await http.get(url);
  dispatch(setTools({ tools: res.data }));
}

export const selectLoaded = (state) => state.tools.loaded;

export const selectLoading = (state) => state.tools.loading;

export const selectTools = (state) => state.tools.tools;

export default toolsSlice.reducer;
