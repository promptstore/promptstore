import { createSlice } from '@reduxjs/toolkit';

import { http } from '../../http';

export const transformationsSlice = createSlice({
  name: 'transformations',
  initialState: {
    loaded: false,
    loading: false,
    transformations: {},
  },
  reducers: {
    removeTransformations: (state, action) => {
      for (const id of action.payload.ids) {
        delete state.transformations[id];
      }
    },
    setTransformations: (state, action) => {
      for (const t of action.payload.transformations) {
        state.transformations[t.id] = t;
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
  removeTransformations,
  setTransformations,
  startLoad,
  startProcessing,
  endProcessing,
} = transformationsSlice.actions;

export const getTransformationsAsync = (params) => async (dispatch) => {
  dispatch(startLoad());
  let url = `/api/workspaces/${params.workspaceId}/transformations`;
  const res = await http.get(url);
  dispatch(setTransformations({ transformations: res.data }));
};

export const getTransformationAsync = (id) => async (dispatch) => {
  dispatch(startLoad());
  const url = `/api/transformations/${id}`;
  const res = await http.get(url);
  dispatch(setTransformations({ transformations: [res.data] }));
};

export const createTransformationAsync = ({ correlationId, values }) => async (dispatch) => {
  const url = '/api/transformations';
  const res = await http.post(url, values);
  dispatch(setTransformations({ transformations: [{ ...res.data, correlationId }] }));
};

export const updateTransformationAsync = ({ id, values }) => async (dispatch) => {
  const url = `/api/transformations/${id}`;
  const res = await http.put(url, values);
  dispatch(setTransformations({ transformations: [res.data] }));
};

export const deleteTransformationsAsync = ({ ids }) => async (dispatch) => {
  const url = `/api/transformations?ids=${ids.join(',')}`;
  await http.delete(url);
  dispatch(removeTransformations({ ids }));
};

export const runTransformationAsync = ({ id, correlationId, workspaceId }) => async (dispatch, getState) => {
  const url = `/api/transformation-runs/${id}`;
  await http.post(url, { correlationId, workspaceId });
  const timeout = 120000;
  const start = new Date();
  const intervalId = setInterval(async () => {
    try {
      const res = await http.get('/api/transformation-status/' + correlationId);
      clearInterval(intervalId);
      // console.log('transformation status res:', res);
      const transformations = getState().transformations.transformations;
      const tx = transformations[id];
      dispatch(setTransformations({ transformations: [{ ...tx, correlationId }] }));
    } catch (err) {
      // 423 - locked ~ not ready
      if (err.response.status !== 423) {
        clearInterval(intervalId);
      } else {
        const now = new Date();
        const diff = now - start;
        if (diff > timeout) {
          clearInterval(intervalId);
        }
      }
    }
  }, 5000);
};

export const pauseScheduleAsync = ({ scheduleId }) => async (dispatch) => {
  const url = `/api/schedules/${scheduleId}/pause`;
  await http.post(url);
};

export const unpauseScheduleAsync = ({ scheduleId }) => async (dispatch) => {
  const url = `/api/schedules/${scheduleId}/unpause`;
  await http.post(url);
};

export const deleteScheduleAsync = ({ scheduleId }) => async (dispatch) => {
  const url = `/api/schedules/${scheduleId}/delete`;
  await http.post(url);
};

export const selectLoaded = (state) => state.transformations.loaded;

export const selectLoading = (state) => state.transformations.loading;

export const selectTransformations = (state) => state.transformations.transformations;

export default transformationsSlice.reducer;
