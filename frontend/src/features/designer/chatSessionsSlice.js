import { createSlice } from '@reduxjs/toolkit';

import { http } from '../../http';

export const chatSessionsSlice = createSlice({
  name: 'chatSessions',
  initialState: {
    loaded: false,
    loading: false,
    chatSessions: {},
  },
  reducers: {
    removeChatSessions: (state, action) => {
      for (const id of action.payload.ids) {
        delete state.chatSessions[id];
      }
    },
    setChatSessions: (state, action) => {
      for (const s of action.payload.chatSessions) {
        state.chatSessions[s.id] = s;
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
  removeChatSessions,
  setChatSessions,
  setTestResult,
  startLoad,
  startTest,
} = chatSessionsSlice.actions;

export const getChatSessionsAsync = () => async (dispatch) => {
  dispatch(startLoad());
  const url = '/api/chat-sessions';
  const res = await http.get(url);
  dispatch(setChatSessions({ chatSessions: res.data }));
};

export const getChatSessionAsync = (id) => async (dispatch) => {
  dispatch(startLoad());
  const url = `/api/chat-sessions/${id}`;
  const res = await http.get(url);
  dispatch(setChatSessions({ chatSessions: [res.data] }));
};

export const createChatSessionAsync = ({ values }) => async (dispatch) => {
  const url = '/api/chat-sessions';
  const res = await http.post(url, values);
  const func = { ...values, id: res.data };
  dispatch(setChatSessions({ chatSessions: [func] }));
};

export const updateChatSessionAsync = ({ id, values }) => async (dispatch) => {
  const url = `/api/chat-sessions/${id}`;
  await http.put(url, values);
  dispatch(setChatSessions({ chatSessions: [{ ...values, id }] }));
};

export const deleteChatSessionsAsync = ({ ids }) => async (dispatch) => {
  const url = `/api/chat-sessions?ids=${ids.join(',')}`;
  await http.delete(url);
  dispatch(removeChatSessions({ ids }));
};

export const selectLoaded = (state) => state.chatSessions.loaded;

export const selectLoading = (state) => state.chatSessions.loading;

export const selectChatSessions = (state) => state.chatSessions.chatSessions;

export default chatSessionsSlice.reducer;
