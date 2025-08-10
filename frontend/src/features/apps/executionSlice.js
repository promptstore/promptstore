import { createSlice } from '@reduxjs/toolkit';

import { http } from '../../http';
import { setCredits } from '../users/usersSlice';

export const executionSlice = createSlice({
  name: 'execution',
  initialState: {
    results: null,
    loading: false,
    error: null,
  },
  reducers: {
    setExecutionResults: (state, action) => {
      state.results = action.payload.results;
      state.loading = false;
      state.error = null;
    },
    setExecutionError: (state, action) => {
      state.error = action.payload.error;
      state.loading = false;
    },
    startExecution: (state) => {
      state.loading = true;
      state.error = null;
    },
    clearResults: (state) => {
      state.results = null;
      state.error = null;
      state.loading = false;
    },
  }
});

export const {
  setExecutionResults,
  setExecutionError,
  startExecution,
  clearResults,
} = executionSlice.actions;

export const runCompositionExecution = ({ name, args, workspaceId }) => async (dispatch) => {
  dispatch(startExecution());
  try {
    const url = `/api/composition-executions/${name}`;
    const res = await http.post(url, { args, workspaceId });
    const { response, creditBalance } = res.data;
    dispatch(setExecutionResults({ results: response }));
    if (creditBalance) {
      dispatch(setCredits({ credits: creditBalance }));
    }
    return response;
  } catch (error) {
    dispatch(setExecutionError({ error: error.message }));
    throw error;
  }
};

export const runSemanticFunction = ({ name, args, env, workspaceId }) => async (dispatch) => {
  dispatch(startExecution());
  try {
    const url = `/api/executions/${name}`;
    const res = await http.post(url, { 
      args, 
      env, 
      params: { maxTokens: 4096 }, 
      workspaceId 
    });
    const { response, responseMetadata } = res.data;
    dispatch(setExecutionResults({ results: response }));
    if (responseMetadata?.creditBalance) {
      dispatch(setCredits({ credits: responseMetadata.creditBalance }));
    }
    return { response, responseMetadata };
  } catch (error) {
    dispatch(setExecutionError({ error: error.message }));
    throw error;
  }
};

export const selectExecutionResults = (state) => state.execution.results;
export const selectExecutionLoading = (state) => state.execution.loading;
export const selectExecutionError = (state) => state.execution.error;

export default executionSlice.reducer;