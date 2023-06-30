import { createSlice } from '@reduxjs/toolkit';

import { http } from '../../http';

export const promptSetsSlice = createSlice({
  name: 'promptSets',
  initialState: {
    loaded: false,
    loading: false,
    promptSets: {},
  },
  reducers: {
    removePromptSets: (state, action) => {
      for (const id of action.payload.ids) {
        delete state.promptSets[id];
      }
    },
    setPromptSets: (state, action) => {
      for (const set of action.payload.promptSets) {
        state.promptSets[set.id] = set;
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
  removePromptSets,
  setPromptSets,
  startLoad,
} = promptSetsSlice.actions;

export const getPromptSetsAsync = ({ workspaceId }) => async (dispatch) => {
  dispatch(startLoad());
  let url;
  if (workspaceId) {
    url = `/api/workspaces/${workspaceId}/prompt-sets`;
  } else {
    url = `/api/prompt-sets`;
  }
  const res = await http.get(url);
  dispatch(setPromptSets({ promptSets: res.data }));
};

export const getPromptSetBySkillAsync = ({ skill }) => async (dispatch) => {
  dispatch(startLoad());
  const url = `/api/prompt-sets/by-skill/${skill}`;
  const res = await http.get(url);
  dispatch(setPromptSets({ promptSets: [res.data] }));
};

export const getPromptSetAsync = (id) => async (dispatch) => {
  dispatch(startLoad());
  const url = `/api/prompt-sets/${id}`;
  const res = await http.get(url);
  dispatch(setPromptSets({ promptSets: [res.data] }));
};

export const createPromptSetAsync = ({ values }) => async (dispatch) => {
  const url = '/api/prompt-sets';
  const res = await http.post(url, values);
  dispatch(setPromptSets({ promptSets: [{ ...values, id: res.data }] }));
};

export const updatePromptSetAsync = ({ id, values }) => async (dispatch) => {
  const url = `/api/prompt-sets/${id}`;
  const res = await http.put(url, values);
  dispatch(setPromptSets({ promptSets: [res.data] }));
};

export const deletePromptSetsAsync = ({ ids }) => async (dispatch) => {
  const url = `/api/prompt-sets?ids=${ids.join(',')}`;
  await http.delete(url);
  dispatch(removePromptSets({ ids }));
};

export const selectLoaded = (state) => state.promptSets.loaded;

export const selectLoading = (state) => state.promptSets.loading;

export const selectPromptSets = (state) => state.promptSets.promptSets;

export default promptSetsSlice.reducer;
