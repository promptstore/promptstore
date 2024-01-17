import { createSlice } from '@reduxjs/toolkit';

import { http } from '../../http';

export const evaluationsSlice = createSlice({
  name: 'evaluations',
  initialState: {
    loaded: false,
    loading: false,
    evaluations: {},
  },
  reducers: {
    removeEvaluations: (state, action) => {
      for (const id of action.payload.ids) {
        delete state.evaluations[id];
      }
    },
    setEvaluations: (state, action) => {
      for (const t of action.payload.evaluations) {
        state.evaluations[t.id] = t;
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
  removeEvaluations,
  setEvaluations,
  startLoad,
  startProcessing,
  endProcessing,
} = evaluationsSlice.actions;

export const getEvaluationsAsync = (params) => async (dispatch) => {
  dispatch(startLoad());
  let url = `/api/workspaces/${params.workspaceId}/evaluations`;
  const res = await http.get(url);
  dispatch(setEvaluations({ evaluations: res.data }));
};

export const getEvaluationAsync = (id) => async (dispatch) => {
  dispatch(startLoad());
  const url = `/api/evaluations/${id}`;
  const res = await http.get(url);
  dispatch(setEvaluations({ evaluations: [res.data] }));
};

export const createEvaluationAsync = ({ correlationId, values }) => async (dispatch) => {
  const url = '/api/evaluations';
  const res = await http.post(url, values);
  dispatch(setEvaluations({ evaluations: [{ ...res.data, correlationId }] }));
};

export const updateEvaluationAsync = ({ id, values }) => async (dispatch) => {
  const url = `/api/evaluations/${id}`;
  const res = await http.put(url, values);
  dispatch(setEvaluations({ evaluations: [res.data] }));
};

export const deleteEvaluationsAsync = ({ ids }) => async (dispatch) => {
  const url = `/api/evaluations?ids=${ids.join(',')}`;
  await http.delete(url);
  dispatch(removeEvaluations({ ids }));
};

export const runEvaluationAsync = ({ id, correlationId, workspaceId }) => async (dispatch, getState) => {
  const url = `/api/evaluation-runs/${id}`;
  await http.post(url, { correlationId, workspaceId });
  const intervalId = setInterval(async () => {
    try {
      const res = await http.get('/api/evaluation-status/' + correlationId);
      clearInterval(intervalId);
      // console.log('evaluation status res:', res);
      const evaluations = getState().evaluations.evaluations;
      const evaluation = evaluations[id];
      dispatch(setEvaluations({ evaluations: [{ ...evaluation, correlationId }] }));
    } catch (err) {
      // 423 - locked ~ not ready
      if (err.response.status !== 423) {
        clearInterval(intervalId);
      }
    }
  }, 2000);
};

export const selectLoaded = (state) => state.evaluations.loaded;

export const selectLoading = (state) => state.evaluations.loading;

export const selectEvaluations = (state) => state.evaluations.evaluations;

export default evaluationsSlice.reducer;
