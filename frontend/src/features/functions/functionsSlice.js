import { createSlice } from '@reduxjs/toolkit';

import { http } from '../../http';
import { runWithMinDelay } from '../../utils';
import { setCredits } from '../users/usersSlice';

export const functionsSlice = createSlice({
  name: 'functions',
  initialState: {
    loaded: false,
    loading: false,
    functions: {},
    testResult: null,
    testResultLoaded: false,
    testResultLoading: false,
  },
  reducers: {
    removeFunctions: (state, action) => {
      for (const id of action.payload.ids) {
        delete state.functions[id];
      }
    },
    resetFunctions: (state, action) => {
      state.functions = {};
    },
    setFunctions: (state, action) => {
      for (const func of action.payload.functions) {
        state.functions[func.id] = func;
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
  removeFunctions,
  resetFunctions,
  setFunctions,
  setTestResult,
  startLoad,
  startTest,
} = functionsSlice.actions;

export const getFunctionsAsync = ({ workspaceId, minDelay }) => async (dispatch) => {
  dispatch(startLoad());
  const url = `/api/workspaces/${workspaceId}/functions`;
  const startTime = new Date();
  const res = await http.get(url);
  runWithMinDelay(startTime, minDelay, () => {
    dispatch(setFunctions({ functions: res.data }));
  });
};

export const getFunctionsByPromptSetAsync = ({ promptSetId, workspaceId }) => async (dispatch) => {
  dispatch(startLoad());
  dispatch(resetFunctions());
  const url = `/api/workspaces/${workspaceId}/functions-by-promptset/${promptSetId}`;
  const res = await http.get(url);
  dispatch(setFunctions({ functions: res.data }));
};

export const getFunctionsByTagsAsync = ({ tags, workspaceId }) => async (dispatch) => {
  dispatch(startLoad());
  dispatch(resetFunctions());
  const tagsQueryString = tags.map(encodeURIComponent).join(',');
  const url = `/api/workspaces/${workspaceId}/functions/tags?tags=${tagsQueryString}`;
  const res = await http.get(url);
  dispatch(setFunctions({ functions: res.data }));
};

export const getFunctionsByTagAsync = ({ tag, workspaceId, minDelay }) => async (dispatch) => {
  dispatch(startLoad());
  dispatch(resetFunctions());
  const url = `/api/workspaces/${workspaceId}/functions/tags/${tag}`;
  const startTime = new Date();
  const res = await http.get(url);
  runWithMinDelay(startTime, minDelay, () => {
    dispatch(setFunctions({ functions: res.data }));
  });
};

export const getFunctionAsync = (id) => async (dispatch) => {
  dispatch(startLoad());
  const url = `/api/functions/${id}`;
  const res = await http.get(url);
  dispatch(setFunctions({ functions: [res.data] }));
};

export const createFunctionAsync = ({ values }) => async (dispatch) => {
  const url = '/api/functions';
  const res = await http.post(url, values);
  dispatch(setFunctions({ functions: [res.data] }));
};

export const updateFunctionAsync = ({ id, values }) => async (dispatch) => {
  const url = `/api/functions/${id}`;
  const res = await http.put(url, values);
  dispatch(setFunctions({ functions: [res.data] }));
};

export const deleteFunctionsAsync = ({ ids }) => async (dispatch) => {
  const url = `/api/functions?ids=${ids.join(',')}`;
  await http.delete(url);
  dispatch(removeFunctions({ ids }));
};

export const runTestAsync = ({ args, env, modelId, model, name, workspaceId }) => async (dispatch) => {
  dispatch(startTest());
  const url = `/api/executions/${name}`;
  const res = await http.post(url, { args, env, params: { modelId, model: model, maxTokens: 4096 }, workspaceId });
  const { response, responseMetadata } = res.data;
  dispatch(setTestResult({ result: response }));
  dispatch(setCredits({ credits: responseMetadata.creditBalance }));
};

export const selectLoaded = (state) => state.functions.loaded;

export const selectLoading = (state) => state.functions.loading;

export const selectFunctions = (state) => state.functions.functions;

export const selectTestResult = (state) => state.functions.testResult;

export const selectTestResultLoaded = (state) => state.functions.testResultLoaded;

export const selectTestResultLoading = (state) => state.functions.testResultLoading;

export default functionsSlice.reducer;
