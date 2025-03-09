import { createSlice } from '@reduxjs/toolkit';
import { v4 as uuidv4 } from 'uuid';
import { http } from '../../http';

const initialState = {
  scenarios: {},
  loaded: false,
  loading: false,
  running: {},
};

export const testScenariosSlice = createSlice({
  name: 'testScenarios',
  initialState,
  reducers: {
    removeScenarios: (state, action) => {
      for (const id of action.payload.ids) {
        delete state.scenarios[id];
      }
    },
    setScenarios: (state, action) => {
      for (const scenario of action.payload.scenarios) {
        state.scenarios[scenario.id] = scenario;
        state.running[scenario.id] = false;
      }
      state.loaded = true;
      state.loading = false;
    },
    startLoad: state => {
      state.loaded = false;
      state.loading = true;
    },
    startRun: (state, action) => {
      state.running[action.payload.scenarioId] = true;
    },
    stopRun: (state, action) => {
      state.running[action.payload.scenarioId] = false;
    },
  },
});

export const { removeScenarios, setScenarios, startLoad, startRun, stopRun } = testScenariosSlice.actions;

export const getScenariosAsync =
  ({ workspaceId }) =>
  async dispatch => {
    dispatch(startLoad());
    const url = `/api/workspaces/${workspaceId}/test-scenarios`;
    const res = await http.get(url);
    dispatch(setScenarios({ scenarios: res.data }));
  };

export const getScenarioAsync = id => async dispatch => {
  dispatch(startLoad());
  const url = `/api/test-scenarios/${id}`;
  const res = await http.get(url);
  dispatch(setScenarios({ scenarios: [res.data] }));
};

export const createScenarioAsync =
  ({ values }) =>
  async dispatch => {
    const url = '/api/test-scenarios';
    const res = await http.post(url, values);
    dispatch(setScenarios({ scenarios: [res.data] }));
    return res.data;
  };

export const updateScenarioAsync =
  ({ id, values }) =>
  async dispatch => {
    const url = `/api/test-scenarios/${id}`;
    const res = await http.put(url, values);
    dispatch(setScenarios({ scenarios: [res.data] }));
    return res.data;
  };

export const deleteScenariosAsync =
  ({ ids }) =>
  async dispatch => {
    const url = `/api/test-scenarios?ids=${ids.join(',')}`;
    await http.delete(url);
    dispatch(removeScenarios({ ids }));
  };

export const generateOutputsAsync =
  ({ id, workspaceId }) =>
  async dispatch => {
    const correlationId = uuidv4();
    dispatch(startRun({ scenarioId: id }));
    const url = '/api/test-scenario-runs';
    await http.post(url, { correlationId, testScenarioId: id, workspaceId });
    const timeout = 120000;
    const start = new Date();
    const intervalId = setInterval(async () => {
      try {
        const res = await http.get('/api/test-scenario-run-status/' + correlationId);
        const testScenario = res.data;
        clearInterval(intervalId);
        console.log('status response:', testScenario);
        dispatch(setScenarios({ scenarios: [testScenario] }));
      } catch (err) {
        // 423 - locked ~ not ready
        if (err.response?.status !== 423) {
          clearInterval(intervalId);
          dispatch(stopRun({ scenarioId: id }));
        } else {
          const now = new Date();
          const diff = now - start;
          if (diff > timeout) {
            clearInterval(intervalId);
            dispatch(stopRun({ scenarioId: id }));
          }
        }
      }
    }, 5000);
  };

export const selectLoaded = state => state.testScenarios.loaded;

export const selectLoading = state => state.testScenarios.loading;

export const selectScenarios = state => state.testScenarios.scenarios;

export const selectCurrentScenario = state => state.testScenarios.currentScenario;

export const selectRunning = state => state.testScenarios.running;

export default testScenariosSlice.reducer;
