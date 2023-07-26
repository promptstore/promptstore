import { createSlice } from '@reduxjs/toolkit';

import { http } from '../../http';

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

export const getFunctionsAsync = () => async (dispatch) => {
  dispatch(startLoad());
  const url = '/api/functions';
  const res = await http.get(url);
  dispatch(setFunctions({ functions: res.data }));
};

export const getFunctionsByTagAsync = ({ tag }) => async (dispatch) => {
  dispatch(startLoad());
  dispatch(resetFunctions());
  const url = `/api/functions/tags/${tag}`;
  const res = await http.get(url);
  dispatch(setFunctions({ functions: res.data }));
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
  const func = { ...values, id: res.data };
  dispatch(setFunctions({ functions: [func] }));
};

export const updateFunctionAsync = ({ id, values }) => async (dispatch) => {
  const url = `/api/functions/${id}`;
  await http.put(url, values);
  dispatch(setFunctions({ functions: [{ ...values, id }] }));
};

export const deleteFunctionsAsync = ({ ids }) => async (dispatch) => {
  const url = `/api/functions?ids=${ids.join(',')}`;
  await http.delete(url);
  dispatch(removeFunctions({ ids }));
};

export const runTestAsync = ({ args, modelId, modelKey, name }) => async (dispatch) => {
  dispatch(startTest());
  const url = `/api/executions/${name}`;
  const res = await http.post(url, { args, params: { modelId, model: modelKey } });
  dispatch(setTestResult({ result: res.data }));
};

export const selectLoaded = (state) => state.functions.loaded;

export const selectLoading = (state) => state.functions.loading;

export const selectFunctions = (state) => state.functions.functions;

export const selectTestResult = (state) => state.functions.testResult;

export const selectTestResultLoaded = (state) => state.functions.testResultLoaded;

export const selectTestResultLoading = (state) => state.functions.testResultLoading;

export default functionsSlice.reducer;
