import { createSlice } from '@reduxjs/toolkit';

import { http } from '../../http';

export const destinationsSlice = createSlice({
  name: 'destinations',
  initialState: {
    loaded: false,
    loading: false,
    destinations: {},
  },
  reducers: {
    removeDestinations: (state, action) => {
      for (const id of action.payload.ids) {
        delete state.destinations[id];
      }
    },
    resetDestinations: (state) => {
      state.destinations = {};
    },
    setDestinations: (state, action) => {
      for (const dst of action.payload.destinations) {
        state.destinations[dst.id] = dst;
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
  removeDestinations,
  resetDestinations,
  setDestinations,
  startLoad,
} = destinationsSlice.actions;

export const getDestinationsAsync = (params) => async (dispatch) => {
  dispatch(startLoad());
  let url = `/api/workspaces/${params.workspaceId}/destinations`;
  if (params?.type) {
    dispatch(resetDestinations());
    url += '?type=' + params.type;
  }
  const res = await http.get(url);
  dispatch(setDestinations({ destinations: res.data }));
};

export const getDestinationAsync = (id, preview) => async (dispatch) => {
  dispatch(startLoad());
  let url = `/api/destinations/${id}`;
  if (preview) {
    url += '?preview=true';
  }
  const res = await http.get(url);
  dispatch(setDestinations({ destinations: [res.data] }));
};

export const createDestinationAsync = ({ correlationId, values }) => async (dispatch) => {
  const url = '/api/destinations';
  const res = await http.post(url, values);
  dispatch(setDestinations({ destinations: [{ ...res.data, correlationId }] }));
};

export const updateDestinationAsync = ({ id, values }) => async (dispatch) => {
  const url = `/api/destinations/${id}`;
  const res = await http.put(url, values);
  dispatch(setDestinations({ destinations: [res.data] }));
};

export const deleteDestinationsAsync = ({ ids }) => async (dispatch) => {
  const url = `/api/destinations?ids=${ids.join(',')}`;
  await http.delete(url);
  dispatch(removeDestinations({ ids }));
};

export const selectLoaded = (state) => state.destinations.loaded;

export const selectLoading = (state) => state.destinations.loading;

export const selectDestinations = (state) => state.destinations.destinations;

export default destinationsSlice.reducer;
