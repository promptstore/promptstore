import { createSlice } from '@reduxjs/toolkit';
import axios from 'axios';

export const authSlice = createSlice({
  name: 'auth',
  initialState: {
    loaded: false,
    loading: false,
    token: null,
    error: null,
  },
  reducers: {
    setError: (state, action) => {
      state.error = action.payload;
    },
    setToken: (state, action) => {
      state.token = action.payload;
    }
  }
});

export const {
  setError,
  setToken,
  setWorkspaces,
  startLoad,
} = authSlice.actions;

export const getRefreshTokenAsync = (req) => async (dispatch) => {
  const url = '/api/auth/refresh';
  const resp = await axios.post(url, req, {
    headers: {
      'Content-Type': 'application/json',
    }
  });
  if (resp.status === 200) {
    console.log('refresh: ', resp);
    const { access_token, refresh_token } = resp.data;
    dispatch(setToken({
      accessToken: access_token,
      refreshToken: refresh_token,
    }));
  } else {
    dispatch(setError({
      error: resp.data,
    }));
  }
};

export const selectError = (state) => state.auth.error;

export const selectToken = (state) => state.auth.token;

export default authSlice.reducer;
