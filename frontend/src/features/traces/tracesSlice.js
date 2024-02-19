import { createSlice } from '@reduxjs/toolkit';
import qs from 'qs';

import { http } from '../../http';

export const tracesSlice = createSlice({
  name: 'traces',
  initialState: {
    count: 0,
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
    setCount: (state, action) => {
      state.count = action.payload;
    },
    setTraces: (state, action) => {
      state.traces = {};
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
  setCount,
  setTraces,
  startLoad,
} = tracesSlice.actions;

export const getTracesAsync = ({ workspaceId, limit, start, filters }) => async (dispatch) => {
  dispatch(startLoad());
  const url = `/api/workspaces/${workspaceId}/traces?limit=${limit}&start=${start}&${qs.stringify(filters)}`;
  const res = await http.get(url);
  dispatch(setTraces({ traces: res.data.data }));
  dispatch(setCount(res.data.count));
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

export const selectCount = (state) => state.traces.count;

export const selectLoaded = (state) => state.traces.loaded;

export const selectLoading = (state) => state.traces.loading;

export const selectTraces = (state) => state.traces.traces;

export default tracesSlice.reducer;
