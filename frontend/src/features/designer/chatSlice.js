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
    traceId: null,
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
    setTraceId: (state, action) => {
      state.traceId = action.payload.traceId;
    },
  }
});

export const {
  setMessages,
  startLoad,
  setTraceId,
} = chatSlice.actions;

// Not used
export const getPromptsAsync = (req) => async (dispatch) => {
  const url = '/api/prompts';
  const res = await http.post(url, req.app);
  const messages = res.data.map(formatMessage);
  dispatch(getResponseAsync({
    ...req,
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
  const res = await http.post(url, {
    ...req,
    history: req.history.map(cleanMessage),
    messages: req.messages.map(cleanMessage),  // remove keys
  });
  const { completions, traceId } = res.data;
  const messages = [];
  let cost = 0;
  let totalTokens = 0;
  for (const { choices, model, usage } of completions) {
    let i = 0;
    for (const { message } of choices) {
      if (!messages[i]) {
        messages[i] = {
          role: message.role,
          content: [],
          key: uuidv4(),
        };
      }
      messages[i].content.push({
        model,
        content: message.content,
        key: uuidv4(),
      });
      i += 1;
    }
    if (usage) {
      cost += usage.total_tokens / 1000 * 0.002;
      totalTokens += usage.total_tokens;
    }
  }
  dispatch(setMessages({ messages: [...req.originalMessages, ...messages] }));
  dispatch(setTraceId({ traceId }));
  const app = req.app;
  if (app) {
    dispatch(updateAppAsync({
      id: app.id,
      values: {
        tokenCount: (app.tokenCount || 0) + totalTokens,
        cost: (app.cost || 0) + cost,
      }
    }));
  }
};

const cleanHistory = (history) => {
  if (!history) return [];
  return history.map((m) => ({
    role: m.role,
    content: Array.isArray(m.content) ? m.content[0].content : m.content,
  }));
};

export const getFunctionResponseAsync = ({ functionName, args, history, params, workspaceId }) => async (dispatch) => {
  dispatch(startLoad());
  const url = `/api/executions/${functionName}`;
  const res = await http.post(url, { args, history: cleanHistory(history), params, workspaceId });
  const { choices, model, usage } = res.data.response;
  const messages = choices.map(({ message }) => ({
    key: uuidv4(),
    role: message.role,
    content: [
      {
        key: uuidv4(),
        content: message.content,
        model,
      },
    ],
  }));
  const message = { role: 'user', content: args.content };
  dispatch(setMessages({
    messages: [
      ...history,
      formatMessage({ message }),
      ...messages,
    ]
  }));
};

export const selectLoaded = (state) => state.chat.loaded;

export const selectLoading = (state) => state.chat.loading;

export const selectMessages = (state) => state.chat.messages;

export const selectTraceId = (state) => state.chat.traceId;

export default chatSlice.reducer;
