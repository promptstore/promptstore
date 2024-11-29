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
    resetChatSessions: (state, action) => {
      state.chatSessions = {};
    },
    setChatSessions: (state, action) => {
      for (const session of action.payload.chatSessions) {
        state.chatSessions[session.id] = session;
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
  resetChatSessions,
  setChatSessions,
  setTestResult,
  startLoad,
} = chatSessionsSlice.actions;

export const getChatSessionsAsync = ({ workspaceId, type }) => async (dispatch) => {
  dispatch(startLoad());
  dispatch(resetChatSessions());
  const url = `/api/workspaces/${workspaceId}/chat-sessions?type=${type}`;
  const res = await http.get(url);
  dispatch(setChatSessions({ chatSessions: res.data }));
};

export const getChatSessionAsync = (id) => async (dispatch) => {
  dispatch(startLoad());
  const url = `/api/chat-sessions/${id}`;
  const res = await http.get(url);
  dispatch(setChatSessions({ chatSessions: [res.data] }));
};

export const createChatSessionAsync = ({ uuid, values }) => async (dispatch) => {
  const url = `/api/chat-sessions`;
  const res = await http.post(url, values);
  dispatch(setChatSessions({ chatSessions: [{ ...res.data, uuid }] }));
};

export const updateChatSessionAsync = ({ id, values }) => async (dispatch) => {
  const url = `/api/chat-sessions/${id}`;
  const res = await http.put(url, values);
  dispatch(setChatSessions({ chatSessions: [res.data] }));
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
