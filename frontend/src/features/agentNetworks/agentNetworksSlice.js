import { createSlice } from '@reduxjs/toolkit';
import { v4 as uuidv4 } from 'uuid';

import { http } from '../../http';

export const agentNetworksSlice = createSlice({
  name: 'agentNetworks',
  initialState: {
    agentNetworks: {},
    loaded: false,
    loading: false,
    result: {},
    running: {},
  },
  reducers: {
    removeAgentNetworks: (state, action) => {
      for (const id of action.payload.ids) {
        delete state.agentNetworks[id];
      }
    },
    setAgentNetworks: (state, action) => {
      for (const agentNetwork of action.payload.agentNetworks) {
        state.agentNetworks[agentNetwork.id] = agentNetwork;
      }
      state.loaded = true;
      state.loading = false;
    },
    setResult: (state, action) => {
      const { agentNetworkId, response } = action.payload;
      state.result[agentNetworkId] = response;
      state.running[agentNetworkId] = false;
    },
    startLoad: (state) => {
      state.loaded = false;
      state.loading = true;
    },
    startRun: (state, action) => {
      state.running[action.payload.agentNetworkId] = true;
    },
    stopRun: (state, action) => {
      state.running[action.payload.agentNetworkId] = false;
    },
  }
});

export const {
  removeAgentNetworks,
  setAgentNetworks,
  setResult,
  startLoad,
  startRun,
  stopRun,
} = agentNetworksSlice.actions;

export const getAgentNetworksAsync = ({ workspaceId }) => async (dispatch) => {
  dispatch(startLoad());
  const url = `/api/workspaces/${workspaceId}/agent-networks`;
  const res = await http.get(url);
  dispatch(setAgentNetworks({ agentNetworks: res.data }));
};

export const getAgentNetworkAsync = (id) => async (dispatch) => {
  dispatch(startLoad());
  const url = `/api/agent-networks/${id}`;
  const res = await http.get(url);
  dispatch(setAgentNetworks({ agentNetworks: [res.data] }));
};

export const createAgentNetworkAsync = ({ values }) => async (dispatch) => {
  const url = '/api/agent-networks';
  const res = await http.post(url, values);
  dispatch(setAgentNetworks({ agentNetworks: [res.data] }));
};

export const updateAgentNetworkAsync = ({ id, values }) => async (dispatch) => {
  const url = `/api/agent-networks/${id}`;
  const res = await http.put(url, values);
  dispatch(setAgentNetworks({ agentNetworks: [res.data] }));
};

export const deleteAgentNetworksAsync = ({ ids }) => async (dispatch) => {
  const url = `/api/agent-networks?ids=${ids.join(',')}`;
  await http.delete(url);
  dispatch(removeAgentNetworks({ ids }));
};

export const runAgentNetworkAsync = ({ agentNetworkId }) => async (dispatch) => {
  const correlationId = uuidv4();
  dispatch(startRun({ agentNetworkId }));
  const url = '/api/agent-network-runs';
  await http.post(url, { agentNetworkId, correlationId });
  const timeout = 120000;
  const start = new Date();
  const intervalId = setInterval(async () => {
    try {
      const res = await http.get('/api/agent-network-status/' + correlationId);
      const { response } = res.data;
      clearInterval(intervalId);
      console.log('status response:', response);
      dispatch(setResult({ agentNetworkId, response }));
    } catch (err) {
      // 423 - locked ~ not ready
      if (err.response?.status !== 423) {
        clearInterval(intervalId);
        dispatch(stopRun({ agentNetworkId }));
      } else {
        const now = new Date();
        const diff = now - start;
        if (diff > timeout) {
          clearInterval(intervalId);
          dispatch(stopRun({ agentNetworkId }));
        }
      }
    }
  }, 5000);
};

export const selectLoaded = (state) => state.agentNetworks.loaded;

export const selectLoading = (state) => state.agentNetworks.loading;

export const selectAgentNetworks = (state) => state.agentNetworks.agentNetworks;

export const selectResult = (state) => state.agentNetworks.result;

export const selectRunning = (state) => state.agentNetworks.running;

export default agentNetworksSlice.reducer;
