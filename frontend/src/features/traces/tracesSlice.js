import { createSlice } from '@reduxjs/toolkit';

import { http } from '../../http';

export const tracesSlice = createSlice({
  name: 'traces',
  initialState: {
    loaded: false,
    loading: false,
    traces: {},
  },
  reducers: {
    removeTraces: (state, action) => {
      for (const id of action.payload.ids) {
        delete state.traces[id];
      }
    },
    setTraces: (state, action) => {
      for (const trace of action.payload.traces) {
        state.traces[trace.id] = trace;
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
  removeTraces,
  setTraces,
  startLoad,
} = tracesSlice.actions;

export const getTracesAsync = ({ workspaceId }) => async (dispatch) => {
  dispatch(startLoad());
  const url = `/api/workspaces/${workspaceId}/traces`;
  const res = await http.get(url);
  dispatch(setTraces({ traces: res.data }));
};

export const getTraceAsync = (id) => async (dispatch, getState) => {
  dispatch(startLoad());
  const url = `/api/traces/${id}`;
  const res = await http.get(url);
  let traces;
  if (id === 'latest') {
    const existing = Object.values(getState().traces.traces)
      .map(t => ({ ...t, latest: undefined }));
    traces = [...existing, { ...res.data, latest: true }];
  } else {
    traces = [res.data];
  }
  dispatch(setTraces({ traces }));
};

export const createTraceAsync = ({ values }) => async (dispatch) => {
  const url = '/api/traces';
  const res = await http.post(url, values);
  dispatch(setTraces({ traces: [res.data] }));
};

export const updateTraceAsync = ({ id, values }) => async (dispatch) => {
  const url = `/api/traces/${id}`;
  const res = await http.put(url, values);
  dispatch(setTraces({ traces: [res.data] }));
};

export const deleteTracesAsync = ({ ids }) => async (dispatch) => {
  const url = `/api/traces?ids=${ids.join(',')}`;
  await http.delete(url);
  dispatch(removeTraces({ ids }));
};

export const selectLoaded = (state) => state.traces.loaded;

export const selectLoading = (state) => state.traces.loading;

export const selectTraces = (state) => state.traces.traces;

export default tracesSlice.reducer;
