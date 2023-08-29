import { createSlice } from '@reduxjs/toolkit';
import trim from 'lodash.trim';

import { http } from '../../http';

export const agentsSlice = createSlice({
  name: 'agents',
  initialState: {
    loaded: false,
    loading: false,
    running: false,
    agents: {},
    agentOutput: [],
    tools: [],
  },
  reducers: {
    addAgentOutput: (state, action) => {
      state.agentOutput.push(action.payload.output);
    },
    resetAgentOutput: (state, action) => {
      state.agentOutput = [];
    },
    removeAgents: (state, action) => {
      for (const id of action.payload.ids) {
        delete state.agents[id];
      }
    },
    setAgents: (state, action) => {
      for (const a of action.payload.agents) {
        state.agents[a.id] = a;
      }
      state.loaded = true;
      state.loading = false;
    },
    setTools: (state, action) => {
      state.tools = action.payload.tools;
    },
    startLoad: (state) => {
      state.loaded = false;
      state.loading = true;
    },
    startRun: (state) => {
      state.running = true;
      state.output = [];
    },
    stopRun: (state) => {
      state.running = false;
    }
  }
});

export const {
  addAgentOutput,
  resetAgentOutput,
  removeAgents,
  setAgents,
  setTestResult,
  setTools,
  startLoad,
  startTest,
  startRun,
  stopRun,
} = agentsSlice.actions;

export const getAgentsAsync = ({ workspaceId }) => async (dispatch) => {
  dispatch(startLoad());
  const url = `/api/workspaces/${workspaceId}/agents`;
  const res = await http.get(url);
  dispatch(setAgents({ agents: res.data }));
};

export const getAgentAsync = (id) => async (dispatch) => {
  dispatch(startLoad());
  const url = `/api/agents/${id}`;
  const res = await http.get(url);
  dispatch(setAgents({ agents: [res.data] }));
};

export const createAgentAsync = ({ values }) => async (dispatch) => {
  const url = '/api/agents';
  const res = await http.post(url, values);
  dispatch(setAgents({ agents: [res.data] }));
};

export const updateAgentAsync = ({ id, values }) => async (dispatch) => {
  const url = `/api/agents/${id}`;
  const res = await http.put(url, values);
  dispatch(setAgents({ agents: [res.data] }));
};

export const deleteAgentsAsync = ({ ids }) => async (dispatch) => {
  const url = `/api/agents?ids=${ids.join(',')}`;
  await http.delete(url);
  dispatch(removeAgents({ ids }));
};

export const runAgentAsync = ({ agent, workspaceId }) => async (dispatch) => {
  dispatch(startRun());
  const events = new EventSource('/api/agent-events');
  events.onmessage = (event) => {
    const parsedData = JSON.parse(event.data);
    const output = trim(parsedData, '"');
    dispatch(addAgentOutput({ output: { key: Date.now(), output } }));
  }
  http.post('/api/agent-executions/', { agent: { ...agent, tools: agent.tools || [] }, workspaceId })
    .then(() => {
      events.close();
      dispatch(stopRun());
    })
    .catch((err) => {
      console.log(err);
      events.close();
      throw err;
    });
};

export const getToolsAsync = () => async (dispatch) => {
  const url = '/api/tools';
  const res = await http.get(url);
  dispatch(setTools({ tools: res.data }));
}

export const selectLoaded = (state) => state.agents.loaded;

export const selectLoading = (state) => state.agents.loading;

export const selectAgents = (state) => state.agents.agents;

export const selectAgentOutput = (state) => state.agents.agentOutput;

export const selectTools = (state) => state.agents.tools;

export const selectRunning = (state) => state.agents.running;

export default agentsSlice.reducer;
