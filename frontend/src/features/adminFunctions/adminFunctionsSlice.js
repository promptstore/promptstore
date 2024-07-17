import { createSlice } from '@reduxjs/toolkit';

import { http } from '../../http';

export const adminFunctionsSlice = createSlice({
  name: 'adminFunctions',
  initialState: {
    loading: false,
    loaded: false,
  },
  reducers: {
    startLoad: (state, action) => {
      state.loaded = false;
      state.loading = true;
    },
    endLoad: (state, action) => {
      state.loaded = true;
      state.loading = false;
    },
  }
});

export const {
  startLoad,
  endLoad,
} = adminFunctionsSlice.actions;

export const fixFunctionTagSettingsAsync = ({ workspaceId }) => async (dispatch) => {
  dispatch(startLoad());
  let url = `/api/workspaces/${workspaceId}/fix-function-tag-setting`;
  const res = await http.post(url);
  dispatch(endLoad());
};

export const fixPromptSetTagSettingsAsync = ({ workspaceId }) => async (dispatch) => {
  dispatch(startLoad());
  let url = `/api/workspaces/${workspaceId}/fix-promptset-tag-setting`;
  const res = await http.post(url);
  dispatch(endLoad());
};

export const fixSkillSettingsAsync = ({ workspaceId }) => async (dispatch) => {
  dispatch(startLoad());
  let url = `/api/workspaces/${workspaceId}/fix-skill-setting`;
  const res = await http.post(url);
  dispatch(endLoad());
};

export const rebuildSearchIndexAsync = ({ workspaceId }) => async (dispatch) => {
  dispatch(startLoad());
  let url = `/api/workspaces/${workspaceId}/rebuild-search-index`;
  const res = await http.post(url);
  dispatch(endLoad());
};

export const selectLoaded = (state) => state.adminFunctions.loaded;

export const selectLoading = (state) => state.adminFunctions.loading;

export default adminFunctionsSlice.reducer;
