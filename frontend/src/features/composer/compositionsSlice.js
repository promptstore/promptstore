import { createSlice } from '@reduxjs/toolkit';

import { http } from '../../http';
import { setCredits } from '../users/usersSlice';

export const compositionsSlice = createSlice({
  name: 'compositions',
  initialState: {
    loaded: false,
    loading: false,
    compositions: {},
    testResult: null,
    testResultLoaded: false,
    testResultLoading: false,
  },
  reducers: {
    removeCompositions: (state, action) => {
      for (const id of action.payload.ids) {
        delete state.compositions[id];
      }
    },
    setCompositions: (state, action) => {
      for (const func of action.payload.compositions) {
        state.compositions[func.id] = func;
      }
      state.loaded = true;
      state.loading = false;
    },
    setTestResult: (state, action) => {
      state.testResult = action.payload.result;
      state.testResultLoaded = true;
      state.testResultLoading = false;
    },
    startLoad: (state) => {
      state.loaded = false;
      state.loading = true;
    },
    startTest: (state) => {
      state.testResultLoaded = false;
      state.testResultLoading = true;
    },
  }
});

export const {
  removeCompositions,
  setCompositions,
  setTestResult,
  startLoad,
  startTest,
} = compositionsSlice.actions;

export const getCompositionsAsync = ({ workspaceId }) => async (dispatch) => {
  dispatch(startLoad());
  const url = `/api/workspaces/${workspaceId}/compositions`;
  const res = await http.get(url);
  dispatch(setCompositions({ compositions: res.data }));
};

export const getCompositionAsync = (id) => async (dispatch) => {
  dispatch(startLoad());
  const url = `/api/compositions/${id}`;
  const res = await http.get(url);
  dispatch(setCompositions({ compositions: [res.data] }));
};

export const createCompositionAsync = ({ values }) => async (dispatch) => {
  const url = '/api/compositions';
  const res = await http.post(url, values);
  dispatch(setCompositions({ compositions: [res.data] }));
};

export const updateCompositionAsync = ({ id, values }) => async (dispatch) => {
  const url = `/api/compositions/${id}`;
  const res = await http.put(url, values);
  dispatch(setCompositions({ compositions: [res.data] }));
};

export const deleteCompositionsAsync = ({ ids }) => async (dispatch) => {
  const url = `/api/compositions?ids=${ids.join(',')}`;
  await http.delete(url);
  dispatch(removeCompositions({ ids }));
};

export const runTestAsync = ({ args, modelId, modelKey, name, workspaceId }) => async (dispatch) => {
  dispatch(startTest());
  const url = `/api/composition-executions/${name}`;
  const res = await http.post(url, { args, params: { modelId, model: modelKey }, workspaceId });
  const { response, creditBalance } = res.data;
  dispatch(setTestResult({ result: response }));
  dispatch(setCredits({ credits: creditBalance }));
};

export const selectLoaded = (state) => state.compositions.loaded;

export const selectLoading = (state) => state.compositions.loading;

export const selectCompositions = (state) => state.compositions.compositions;

export const selectTestResult = (state) => state.compositions.testResult;

export const selectTestResultLoaded = (state) => state.compositions.testResultLoaded;

export const selectTestResultLoading = (state) => state.compositions.testResultLoading;

export default compositionsSlice.reducer;
