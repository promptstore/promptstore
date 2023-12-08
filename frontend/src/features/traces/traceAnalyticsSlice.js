import { createSlice } from '@reduxjs/toolkit';

import { http } from '../../http';

export const traceAnalyticsSlice = createSlice({
  name: 'traceAnalytics',
  initialState: {
    loaded: false,
    loading: false,
    analytics: {},
  },
  reducers: {
    setAnalytics: (state, action) => {
      state.analytics = action.payload.analytics;
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
  setAnalytics,
  startLoad,
} = traceAnalyticsSlice.actions;

export const getAnalyticsAsync = ({ workspaceId }) => async (dispatch) => {
  dispatch(startLoad());
  const url = `/api/workspaces/${workspaceId}/trace-analytics`;
  const res = await http.get(url);
  dispatch(setAnalytics({ analytics: res.data }));
};

export const selectLoaded = (state) => state.traceAnalytics.loaded;

export const selectLoading = (state) => state.traceAnalytics.loading;

export const selectAnalytics = (state) => state.traceAnalytics.analytics;

export default traceAnalyticsSlice.reducer;
