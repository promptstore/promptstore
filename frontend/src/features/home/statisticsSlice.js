import { createSlice } from '@reduxjs/toolkit';

import { http } from '../../http';

export const statisticsSlice = createSlice({
  name: 'statistics',
  initialState: {
    loaded: false,
    loading: false,
    statistics: {},
  },
  reducers: {
    setStatistics: (state, action) => {
      state.statistics = action.payload.statistics;
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
  setStatistics,
  startLoad,
} = statisticsSlice.actions;

export const getStatisticsAsync = ({ workspaceId }) => async (dispatch) => {
  dispatch(startLoad());
  const url = `/api/workspaces/${workspaceId}/statistics`;
  const res = await http.get(url);
  dispatch(setStatistics({ statistics: res.data }));
};

export const selectLoaded = (state) => state.statistics.loaded;

export const selectLoading = (state) => state.statistics.loading;

export const selectStatistics = (state) => state.statistics.statistics;

export default statisticsSlice.reducer;
