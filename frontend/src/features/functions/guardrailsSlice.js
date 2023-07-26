import { createSlice } from '@reduxjs/toolkit';

import { http } from '../../http';

export const guardrailsSlice = createSlice({
  name: 'guardrails',
  initialState: {
    loaded: false,
    loading: false,
    guardrails: [],
  },
  reducers: {
    setGuardrails: (state, action) => {
      state.guardrails = action.payload.guardrails;
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
  setGuardrails,
  startLoad,
} = guardrailsSlice.actions;

export const getGuardrailsAsync = () => async (dispatch) => {
  dispatch(startLoad());
  const url = '/api/guardrails';
  const res = await http.get(url);
  dispatch(setGuardrails({ guardrails: res.data }));
};

export const selectLoaded = (state) => state.guardrails.loaded;

export const selectLoading = (state) => state.guardrails.loading;

export const selectGuardrails = (state) => state.guardrails.guardrails;

export default guardrailsSlice.reducer;
