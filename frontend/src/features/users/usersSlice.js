import { createSlice } from '@reduxjs/toolkit';
import axios from 'axios';

import { http } from '../../http';

export const usersSlice = createSlice({
  name: 'users',
  initialState: {
    authStatusChecked: false,
    currentUser: null,
    error: null,
    loaded: false,
    loading: false,
    users: {},
  },
  reducers: {
    setCurrentUser: (state, action) => {
      state.currentUser = action.payload.currentUser;
      state.authStatusChecked = true;
    },
    setError: (state, action) => {
      state.error = action.payload.error;
      state.loaded = true;
      state.loading = false;
    },
    setUsers: (state, action) => {
      for (const user of action.payload.users) {
        state.users[user.id] = user;
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
  setCurrentUser,
  setError,
  setUsers,
  startLoad,
} = usersSlice.actions;

export const getUsersAsync = () => async (dispatch) => {
  dispatch(startLoad());
  const url = '/api/users';
  try {
    const res = await http.get(url);
    dispatch(setUsers({ users: res.data }));
  } catch (error) {
    dispatch(setError({ error: { message: String(error) } }));
  }
};

export const getUserAsync = (id) => async (dispatch) => {
  dispatch(startLoad());
  const url = `/api/users/id/${id}`;
  try {
    const res = await http.get(url);
    dispatch(setUsers({ users: [res.data] }));
  } catch (error) {
    dispatch(setError({ error: { message: String(error) } }));
  }
};

export const getCurrentUserAsync = () => async (dispatch) => {
  const url = `/api/users/current`;
  try {
    // const res = await axios.get(url);
    const res = await http.get(url);
    dispatch(setCurrentUser({ currentUser: res.data }));
  } catch (err) {
    console.error(err);
    // window.location.replace('/login');
  }
};

export const upsertUserAsync = ({ user }) => async (dispatch) => {
  const url = '/api/users';
  const res = await http.post(url, user);
  dispatch(setUsers({ users: [res.data] }));
};

export const setAdmin = () => async (dispatch) => {
  const url = 'api/roles';
  const res = await http.post(url, { role: 'admin' });
};

export const selectAuthStatusChecked = (state) => state.users.authStatusChecked;

export const selectCurrentUser = (state) => state.users.currentUser;

export const selectLoaded = (state) => state.users.loaded;

export const selectLoading = (state) => state.users.loading;

export const selectUsers = (state) => state.users.users;

export default usersSlice.reducer;
