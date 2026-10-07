import { createSlice } from '@reduxjs/toolkit';

import { http } from '../../http';

export const mcpServersSlice = createSlice({
  name: 'mcpServers',
  initialState: {
    loaded: false,
    loading: false,
    mcpServers: {},
    tools: {},  // serverId -> { loading, tools, error }
  },
  reducers: {
    removeMcpServers: (state, action) => {
      for (const id of action.payload.ids) {
        delete state.mcpServers[id];
        delete state.tools[id];
      }
    },
    setMcpServers: (state, action) => {
      for (const server of action.payload.mcpServers) {
        state.mcpServers[server.id] = server;
      }
      state.loaded = true;
      state.loading = false;
    },
    resetMcpServers: (state) => {
      state.mcpServers = {};
    },
    setTools: (state, action) => {
      const { id, ...rest } = action.payload;
      state.tools[id] = rest;
    },
    startLoad: (state) => {
      state.loaded = false;
      state.loading = true;
    },
  }
});

export const {
  removeMcpServers,
  resetMcpServers,
  setMcpServers,
  setTools,
  startLoad,
} = mcpServersSlice.actions;

export const getMcpServersAsync = ({ workspaceId }) => async (dispatch) => {
  dispatch(startLoad());
  const url = `/api/workspaces/${workspaceId}/mcp-servers`;
  const res = await http.get(url);
  dispatch(resetMcpServers());
  dispatch(setMcpServers({ mcpServers: res.data }));
};

export const createMcpServerAsync = ({ values }) => async (dispatch) => {
  const res = await http.post('/api/mcp-servers', values);
  dispatch(setMcpServers({ mcpServers: [res.data] }));
  return res.data;
};

export const updateMcpServerAsync = ({ id, values }) => async (dispatch) => {
  const res = await http.put(`/api/mcp-servers/${id}`, values);
  dispatch(setMcpServers({ mcpServers: [res.data] }));
  dispatch(setTools({ id, tools: null, loading: false, error: null }));
  return res.data;
};

export const deleteMcpServersAsync = ({ ids }) => async (dispatch) => {
  await http.delete(`/api/mcp-servers?ids=${ids.join(',')}`);
  dispatch(removeMcpServers({ ids }));
};

export const getMcpToolsAsync = ({ id, refresh = false }) => async (dispatch) => {
  dispatch(setTools({ id, tools: null, loading: true, error: null }));
  try {
    const res = await http.get(`/api/mcp-servers/${id}/tools${refresh ? '?refresh=true' : ''}`);
    dispatch(setTools({ id, tools: res.data, loading: false, error: null }));
  } catch (err) {
    const message = err.response?.data?.errors?.[0]?.message || err.message;
    dispatch(setTools({ id, tools: null, loading: false, error: message }));
  }
};

export const selectLoaded = (state) => state.mcpServers.loaded;

export const selectLoading = (state) => state.mcpServers.loading;

export const selectMcpServers = (state) => state.mcpServers.mcpServers;

export const selectMcpTools = (state) => state.mcpServers.tools;

export default mcpServersSlice.reducer;
