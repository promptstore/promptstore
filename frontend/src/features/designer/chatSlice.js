import { createSlice } from '@reduxjs/toolkit';
import { v4 as uuidv4 } from 'uuid';

import { updateAppAsync } from '../apps/appsSlice';
import { http } from '../../http';
import { setCredits } from '../users/usersSlice';

import { setChatSessions } from './chatSessionsSlice';

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
  const messages = res.data;  //.map(formatMessage);
  dispatch(getResponseAsync({
    ...req,
    messages: [...req.messages, ...messages],
  }));
};

const cleanMessage = (m) => {
  if (Array.isArray(m.content)) {
    return {
      role: m.role,
      content: m.content.map(msg => {
        msg = { ...msg };
        delete msg.key;
        return msg;
      }),
    };
  }
  return {
    role: m.role,
    content: m.content,
  };
};

// const formatMessage = ({ message }) => ({
//   key: uuidv4(),
//   role: message.role,
//   content: message.content,
// });

export const getResponseAsync = (req) => async (dispatch) => {
  dispatch(startLoad());
  const url = '/api/chat';
  const payload = {
    ...req,
    history: req.history.map(cleanMessage),
    messages: req.messages.map(cleanMessage),  // remove keys
    app: 'promptstore',
  };
  const res = await http.post(url, payload);
  const { completions, lastSession, traceId, creditBalance } = res.data;
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
        citation_metadata: message.citation_metadata,
        key: uuidv4(),
      });
      i += 1;
    }
    if (usage) {
      cost += usage.total_tokens / 1000 * 0.002;
      totalTokens += usage.total_tokens;
    }
  }
  const allMessages = [...req.originalMessages, ...messages];
  dispatch(setMessages({ messages: allMessages.map((m, index) => ({ ...m, index })) }));
  dispatch(setChatSessions({ chatSessions: [lastSession] }));
  dispatch(setTraceId({ traceId }));
  dispatch(setCredits({ credits: creditBalance }));
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

export const getFunctionResponseAsync = ({
  functionName,
  args,
  history,
  params,
  workspaceId,
  extraIndexes,
  functionId,
  modelId,
  models,
  selectedTags,
}) => async (dispatch) => {
  dispatch(startLoad());
  const url = `/api/rag/${functionName}`;
  const res = await http.post(url, {
    args,
    history,
    params,
    workspaceId,
    extraIndexes,
    functionId,
    modelId,
    models,
    selectedTags,
  });

  // const { choices, model, usage } = res.data.response;
  // const messages = choices.map(({ message }) => ({
  //   key: uuidv4(),
  //   role: message.role,
  //   content: [
  //     {
  //       key: uuidv4(),
  //       content: message.content,
  //       citation_metadata: message.citation_metadata,
  //       model,
  //     },
  //   ],
  // }));
  // // add unique key for react
  // const message = { role: 'user', content: args.content, key: uuidv4() };
  // dispatch(setMessages({
  //   messages: [
  //     ...history,
  //     message,
  //     ...messages,
  //   ]
  // }));

  const { completions, lastSession, traceId, creditBalance } = res.data;
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
        citation_metadata: message.citation_metadata,
        key: uuidv4(),
      });
      i += 1;
    }
    if (usage) {
      cost += usage.total_tokens / 1000 * 0.002;
      totalTokens += usage.total_tokens;
    }
  }
  const message = { role: 'user', content: args.content, key: uuidv4() };
  const allMessages = [...history, message, ...messages];
  // console.log('allMessages:', allMessages);
  dispatch(setMessages({ messages: allMessages.map((m, index) => ({ ...m, index })) }));
  dispatch(setChatSessions({ chatSessions: [lastSession] }));
  dispatch(setTraceId({ traceId }));
  dispatch(setCredits({ credits: creditBalance }));

};

export const selectLoaded = (state) => state.chat.loaded;

export const selectLoading = (state) => state.chat.loading;

export const selectMessages = (state) => state.chat.messages;

export const selectTraceId = (state) => state.chat.traceId;

export default chatSlice.reducer;
