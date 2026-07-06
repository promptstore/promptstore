import { createSlice } from '@reduxjs/toolkit';

import { http } from '../../http';

// Cost & usage dashboard state. All reads are pre-aggregated server-side (the
// opposite of the legacy TracesDashboard's client-side crunching) so the views
// just bind.

export const harnessCostSlice = createSlice({
  name: 'harnessCost',
  initialState: {
    loading: false,
    kpis: null,
    summary: null,          // { from, to, bucket, groupBy, data: [rollup rows] }
    distribution: [],       // [{ provider, model, cost, total_tokens }]
    perRun: [],
    budgets: [],
    budgetStatus: [],
  },
  reducers: {
    setLoading: (s, a) => { s.loading = a.payload; },
    setKpis: (s, a) => { s.kpis = a.payload; },
    setSummary: (s, a) => { s.summary = a.payload; },
    setDistribution: (s, a) => { s.distribution = a.payload; },
    setPerRun: (s, a) => { s.perRun = a.payload; },
    setBudgets: (s, a) => { s.budgets = a.payload; },
    setBudgetStatus: (s, a) => { s.budgetStatus = a.payload; },
  },
});

export const {
  setLoading, setKpis, setSummary, setDistribution, setPerRun, setBudgets, setBudgetStatus,
} = harnessCostSlice.actions;

const qsWin = ({ from, to, ...rest }) => {
  const p = new URLSearchParams();
  if (from) p.set('from', from);
  if (to) p.set('to', to);
  Object.entries(rest).forEach(([k, v]) => { if (v != null) p.set(k, v); });
  return p.toString();
};

export const getCostKpisAsync = ({ workspaceId, from, to }) => async (dispatch) => {
  const res = await http.get(`/api/workspaces/${workspaceId}/harness/cost/kpis?${qsWin({ from, to })}`);
  dispatch(setKpis(res.data));
};

export const getCostSummaryAsync = ({ workspaceId, from, to, groupBy, bucket }) => async (dispatch) => {
  const res = await http.get(`/api/workspaces/${workspaceId}/harness/cost/summary?${qsWin({ from, to, groupBy, bucket })}`);
  dispatch(setSummary(res.data));
};

export const getCostDistributionAsync = ({ workspaceId, from, to }) => async (dispatch) => {
  const res = await http.get(`/api/workspaces/${workspaceId}/harness/cost/distribution?${qsWin({ from, to })}`);
  dispatch(setDistribution(res.data.data));
};

export const getPerRunAsync = ({ workspaceId, from, to, limit = 20 }) => async (dispatch) => {
  const res = await http.get(`/api/workspaces/${workspaceId}/harness-traces?${qsWin({ from, to, limit })}`);
  dispatch(setPerRun(res.data.data));
};

export const getBudgetsAsync = ({ workspaceId }) => async (dispatch) => {
  const [b, s] = await Promise.all([
    http.get(`/api/workspaces/${workspaceId}/harness/budgets`),
    http.get(`/api/workspaces/${workspaceId}/harness/budgets/status`),
  ]);
  dispatch(setBudgets(b.data));
  dispatch(setBudgetStatus(s.data));
};

export const saveBudgetAsync = ({ workspaceId, budget }) => async (dispatch) => {
  await http.put(`/api/workspaces/${workspaceId}/harness/budgets`, budget);
  dispatch(getBudgetsAsync({ workspaceId }));
};

export const deleteBudgetAsync = ({ workspaceId, id }) => async (dispatch) => {
  await http.delete(`/api/workspaces/${workspaceId}/harness/budgets/${id}`);
  dispatch(getBudgetsAsync({ workspaceId }));
};

export const loadCostDashboardAsync = ({ workspaceId, from, to, groupBy }) => async (dispatch) => {
  dispatch(setLoading(true));
  try {
    await Promise.all([
      dispatch(getCostKpisAsync({ workspaceId, from, to })),
      dispatch(getCostSummaryAsync({ workspaceId, from, to, groupBy })),
      dispatch(getCostDistributionAsync({ workspaceId, from, to })),
      dispatch(getPerRunAsync({ workspaceId, from, to })),
      dispatch(getBudgetsAsync({ workspaceId })),
    ]);
  } finally {
    dispatch(setLoading(false));
  }
};

export const selectCost = (state) => state.harnessCost;

export default harnessCostSlice.reducer;
