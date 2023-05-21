import { createSlice } from '@reduxjs/toolkit';

import { http } from '../../http';

import { setLikes } from '../apps/Playground/contentSlice';

export const trainingSlice = createSlice({
  name: 'training',
  initialState: {
    loaded: false,
    loading: false,
    data: {},
  },
  reducers: {
    removeData: (state, action) => {
      for (const id of action.payload.ids) {
        delete state.data[id];
      }
    },
    setData: (state, action) => {
      for (const row of action.payload.data) {
        state.data[row.id] = row;
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
  removeData,
  setData,
  startLoad,
} = trainingSlice.actions;

export const getTrainingDataAsync = ({ workspaceId }) => async (dispatch) => {
  dispatch(startLoad());
  const url = `/api/workspaces/${workspaceId}/training`;
  const res = await http.get(url);
  dispatch(setData({ data: res.data }));
};

export const getTrainingRowAsync = (id) => async (dispatch) => {
  dispatch(startLoad());
  const url = `/api/training/${id}`;
  const res = await http.get(url);
  dispatch(setData({ data: [res.data] }));
};

export const createTrainingRowAsync = (req) => async (dispatch) => {
  const url = '/api/training';
  const res = await http.post(url, req);
  dispatch(setData({ data: [{ ...req, id: res.data }] }));
  dispatch(setLikes({ contentId: req.contentId, likes: true }));
};

export const updateTrainingRowAsync = ({ id, values }) => async (dispatch) => {
  const url = `/api/training/${id}`;
  await http.put(url, values);
  dispatch(setData({ data: [{ ...values, id }] }));
};

export const deleteTrainingDataAsync = ({ ids }) => async (dispatch) => {
  const url = `/api/training?ids=${ids.join(',')}`;
  await http.delete(url);
  dispatch(removeData({ ids }));
};

export const deleteTrainingRowAsync = ({ contentId }) => async (dispatch) => {
  const url = `/api/content/${contentId}/training`;
  const res = await http.delete(url);
  dispatch(removeData({ ids: res.data }));
  dispatch(setLikes({ contentId, likes: false }));
};

export const selectLoaded = (state) => state.training.loaded;

export const selectLoading = (state) => state.training.loading;

export const selectTrainingData = (state) => state.training.data;

export default trainingSlice.reducer;
