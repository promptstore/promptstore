import { createSlice } from '@reduxjs/toolkit';

import { http } from '../../http';

// Tuning insights: ranked rule-based cards + diagnostic chart data, all
// pre-computed server-side.

export const harnessInsightsSlice = createSlice({
  name: 'harnessInsights',
  initialState: { loading: false, insights: [], charts: null, from: null, to: null },
  reducers: {
    startLoad: (s) => { s.loading = true; },
    setInsights: (s, a) => {
      s.insights = a.payload.insights || [];
      s.charts = a.payload.charts || null;
      s.from = a.payload.from;
      s.to = a.payload.to;
      s.loading = false;
    },
  },
});

export const { startLoad, setInsights } = harnessInsightsSlice.actions;

export const getInsightsAsync = ({ workspaceId, from, to }) => async (dispatch) => {
  dispatch(startLoad());
  const p = new URLSearchParams();
  if (from) p.set('from', from);
  if (to) p.set('to', to);
  const res = await http.get(`/api/workspaces/${workspaceId}/harness/insights?${p.toString()}`);
  dispatch(setInsights(res.data));
};

export const selectInsights = (state) => state.harnessInsights;

export default harnessInsightsSlice.reducer;
