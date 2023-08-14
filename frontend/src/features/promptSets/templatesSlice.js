import { createSlice } from '@reduxjs/toolkit';

import { http } from '../../http';

export const templatesSlice = createSlice({
  name: 'templates',
  initialState: {
    loaded: false,
    loading: false,
    templates: {},
  },
  reducers: {
    removeTemplates: (state, action) => {
      for (const id of action.payload.ids) {
        delete state.templates[id];
      }
    },
    setTemplates: (state, action) => {
      for (const set of action.payload.templates) {
        state.templates[set.id] = set;
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
  removeTemplates,
  setTemplates,
  startLoad,
} = templatesSlice.actions;

export const getTemplatesAsync = (workspaceId) => async (dispatch) => {
  dispatch(startLoad());
  const url = `/api/workspaces/${workspaceId}/prompt-set-templates`;
  const res = await http.get(url);
  dispatch(setTemplates({ templates: res.data }));
};

export const selectLoaded = (state) => state.templates.loaded;

export const selectLoading = (state) => state.templates.loading;

export const selectTemplates = (state) => state.templates.templates;

export default templatesSlice.reducer;
