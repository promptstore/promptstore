import { createSlice } from '@reduxjs/toolkit';

import { http } from '../../http';

export const evaluationRunsSlice = createSlice({
  name: 'evaluationRuns',
  initialState: {
    loaded: false,
    loading: false,
    runs: {},
  },
  reducers: {
    setRuns: (state, action) => {
      for (const r of action.payload.runs) {
        state.runs[r.id] = r;
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
  setRuns,
  startLoad,
} = evaluationRunsSlice.actions;

export const getEvaluationRunsAsync = ({ workspaceId }) => async (dispatch) => {
  dispatch(startLoad());
  let url = `/api/workspaces/${workspaceId}/evaluation-runs`;
  const res = await http.get(url);
  dispatch(setRuns({ runs: res.data }));
};

export const selectLoaded = (state) => state.evaluationRuns.loaded;

export const selectLoading = (state) => state.evaluationRuns.loading;

export const selectEvaluationRuns = (state) => state.evaluationRuns.runs;

export default evaluationRunsSlice.reducer;
