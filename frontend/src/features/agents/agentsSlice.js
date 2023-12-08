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

const MAX_RETRY_COUNT = 3;

let events;

export const runAgentAsync = ({ agent, workspaceId }) => async (dispatch) => {
  dispatch(startRun());
  http.post('/api/agent-executions/', { agent, workspaceId })
    .then(() => {
      if (events) {
        // allow a bit of time for server-side events to flush
        setTimeout(() => {
          events.close();
        }, 3000);
      }
      dispatch(stopRun());
    })
    .catch((err) => {
      console.log(err);
      if (events) {
        setTimeout(() => {
          events.close();
        }, 3000);
      }
      throw err;
    });
  listen(dispatch);
};

const listen = (dispatch, retries = 0) => {
  events = new EventSource('/api/agent-events');
  events.onmessage = (event) => {
    const parsedData = JSON.parse(event.data);
    let output = trim(parsedData, '"');
    dispatch(addAgentOutput({ output: { key: Date.now(), output } }));
  }
  events.onerror = (err) => {
    console.error('EventSource error:', err);
    events.close();
    if (retries < MAX_RETRY_COUNT) {
      setTimeout(() => listen(dispatch, retries + 1), 200);
    }
  }
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
