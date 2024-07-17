import { createSlice } from '@reduxjs/toolkit';

import { http } from '../../http';

export const rulesSlice = createSlice({
  name: 'rules',
  initialState: {
    loaded: false,
    loading: false,
    rules: {},
  },
  reducers: {
    removeRules: (state, action) => {
      for (const id of action.payload.ids) {
        delete state.rules[id];
      }
    },
    setRules: (state, action) => {
      for (const rule of action.payload.rules) {
        state.rules[rule.id] = rule;
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
  removeRules,
  setRules,
  startLoad,
} = rulesSlice.actions;

export const getRulesAsync = ({ workspaceId, type }) => async (dispatch) => {
  dispatch(startLoad());
  let url = `/api/workspaces/${workspaceId}/rules`;
  if (type) {
    url += '?type=' + type;
  }
  const res = await http.get(url);
  dispatch(setRules({ rules: res.data }));
};

export const getRuleAsync = (id) => async (dispatch) => {
  dispatch(startLoad());
  const url = `/api/rules/${id}`;
  const res = await http.get(url);
  dispatch(setRules({ rules: [res.data] }));
};

export const createRuleAsync = ({ values }) => async (dispatch) => {
  const url = '/api/rules';
  const res = await http.post(url, values);
  dispatch(setRules({ rules: [res.data] }));
};

export const updateRuleAsync = ({ id, values }) => async (dispatch) => {
  const url = `/api/rules/${id}`;
  const res = await http.put(url, values);
  dispatch(setRules({ rules: [res.data] }));
};

export const deleteRulesAsync = ({ ids }) => async (dispatch) => {
  const url = `/api/rules?ids=${ids.join(',')}`;
  await http.delete(url);
  dispatch(removeRules({ ids }));
};

export const deployRuleAsync = ({ correlationId, id, rulesetId }) => async (dispatch) => {
  const url = `/api/rules/${id}/deploy`;
  const res = await http.post(url, { rulesetId });
  dispatch(setRules({ rules: [{ ...res.data, correlationId }] }));
};

export const selectLoaded = (state) => state.rules.loaded;

export const selectLoading = (state) => state.rules.loading;

export const selectRules = (state) => state.rules.rules;

export default rulesSlice.reducer;
