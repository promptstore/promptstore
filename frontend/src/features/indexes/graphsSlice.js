import { createSlice } from '@reduxjs/toolkit';

import { http } from '../../http';

export const graphsSlice = createSlice({
  name: 'graphs',
  initialState: {
    loaded: false,
    loading: false,
    graphs: {},
  },
  reducers: {
    setGraphs: (state, action) => {
      for (const graph of action.payload.graphs) {
        state.graphs[graph.indexName] = graph;
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
  setGraphs,
  startLoad,
} = graphsSlice.actions;

export const getGraphAsync = ({ graphStoreProvider, indexName }) => async (dispatch) => {
  dispatch(startLoad());
  const url = `/api/graphs?provider=${graphStoreProvider}&index=${indexName}`;
  const res = await http.get(url);
  dispatch(setGraphs({ graphs: [res.data] }));
};

export const selectLoaded = (state) => state.graphs.loaded;

export const selectLoading = (state) => state.graphs.loading;

export const selectGraphs = (state) => state.graphs.graphs;

export default graphsSlice.reducer;
