import { createSlice } from '@reduxjs/toolkit';
import { v4 as uuidv4 } from 'uuid';

import { updateAppAsync } from '../apps/appsSlice';
import { http } from '../../http';

export const chatSlice = createSlice({
  name: 'chat',
  initialState: {
    loaded: false,
    loading: false,
    messages: [],
  },
  reducers: {
    setMessages: (state, action) => {
      state.messages = action.payload.messages;
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
  setMessages,
  startLoad,
} = chatSlice.actions;

export const getPromptsAsync = (req) => async (dispatch) => {
  const url = '/api/prompts';
  const res = await http.post(url, req.app);
  const messages = res.data.map(formatMessage);
  dispatch(getResponseAsync({
    app: req.app,
    messages: [...req.messages, ...messages],
  }));
};

const cleanMessage = (message) => ({
  role: message.role,
  content: message.content,
});

const formatMessage = ({ message }) => ({
  key: uuidv4(),
  role: message.role,
  content: message.content,
});

export const getResponseAsync = (req) => async (dispatch) => {
  dispatch(startLoad());
  const url = '/api/chat';
  // console.log('req:', req);
  const res = await http.post(url, { ...req, messages: req.messages.map(cleanMessage) });
  const { choices, model, usage } = res.data;
  const messages = choices.map(formatMessage).map((m) => ({
    ...m,
    model,
    usage,
  }));
  dispatch(setMessages({ messages: [...req.messages, ...messages] }));
  const cost = usage.total_tokens / 1000 * 0.002;
  const app = req.app;
  if (app) {
    dispatch(updateAppAsync({
      id: app.id,
      values: {
        tokenCount: (app.tokenCount || 0) + usage.total_tokens,
        cost: (app.cost || 0) + cost,
      }
    }));
  }
};

export const selectLoaded = (state) => state.chat.loaded;

export const selectLoading = (state) => state.chat.loading;

export const selectMessages = (state) => state.chat.messages;

export default chatSlice.reducer;
