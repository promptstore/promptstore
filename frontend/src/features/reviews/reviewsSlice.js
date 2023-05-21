import { createSlice } from '@reduxjs/toolkit';

import { http } from '../../http';

export const reviewsSlice = createSlice({
  name: 'reviews',
  initialState: {
    loaded: false,
    loading: false,
    reviews: {},
  },
  reducers: {
    removeReviews: (state, action) => {
      for (const id of action.payload.ids) {
        delete state.reviews[id];
      }
    },
    setReviews: (state, action) => {
      for (const content of action.payload.contents) {
        state.reviews[content.id] = content;
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
  removeReviews,
  setReviews,
  startLoad,
} = reviewsSlice.actions;

export const getContentsForReviewAsync = ({ userId, }) => async (dispatch) => {
  dispatch(startLoad());
  const url = `/api/users/${userId}/content`;
  const res = await http.get(url);
  dispatch(setReviews({ contents: res.data }));
};

export const selectLoaded = (state) => state.reviews.loaded;

export const selectLoading = (state) => state.reviews.loading;

export const selectReviews = (state) => state.reviews.reviews;

export default reviewsSlice.reducer;
