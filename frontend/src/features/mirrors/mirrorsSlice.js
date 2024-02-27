import { createSlice } from '@reduxjs/toolkit';

import { http } from '../../http';

export const mirrorsSlice = createSlice({
  name: 'mirrors',
  initialState: {
    loaded: false,
    loading: false,
    mirrors: {},
    preview: null,
    sourceWorkspacesLoaded: false,
    sourceWorkspacesLoading: false,
    sourceWorkspaces: {},
    ran: false,
    running: false,
  },
  reducers: {
    removeMirrors: (state, action) => {
      for (const id of action.payload.ids) {
        delete state.mirrors[id];
      }
    },
    resetMirrors: (state) => {
      state.mirrors = {};
    },
    setMirrors: (state, action) => {
      for (const mirror of action.payload.mirrors) {
        state.mirrors[mirror.id] = mirror;
      }
      state.loaded = true;
      state.loading = false;
    },
    setPreview: (state, action) => {
      state.preview = action.payload.preview;
      state.ran = true;
      state.running = false;
    },
    setSourceWorkspaces: (state, action) => {
      for (const workspace of action.payload.workspaces) {
        state.sourceWorkspaces[workspace.id] = workspace;
      }
      state.sourceWorkspacesLoaded = true;
      state.sourceWorkspacesLoading = false;
    },
    startLoad: (state) => {
      state.loaded = false;
      state.loading = true;
    },
    startRun: (state) => {
      state.ran = false;
      state.running = true;
    },
    startSourceWorkspacesLoad: (state) => {
      state.sourceWorkspacesLoaded = false;
      state.sourceWorkspacesLoading = true;
    },
  }
});

export const {
  removeMirrors,
  resetMirrors,
  setMirrors,
  setPreview,
  setSourceWorkspaces,
  startLoad,
  startRun,
  startSourceWorkspacesLoad,
} = mirrorsSlice.actions;

export const getMirrorsAsync = () => async (dispatch) => {
  dispatch(startLoad());
  const url = `/api/mirrors`;
  const res = await http.get(url);
  dispatch(setMirrors({ mirrors: res.data }));
};

export const getMirrorAsync = (id) => async (dispatch) => {
  dispatch(startLoad());
  const url = `/api/mirrors/${id}`;
  const res = await http.get(url);
  dispatch(setMirrors({ mirrors: [res.data] }));
};

export const createMirrorAsync = ({ values }) => async (dispatch) => {
  const url = '/api/mirrors';
  const res = await http.post(url, values);
  dispatch(setMirrors({ mirrors: [res.data] }));
};

export const updateMirrorAsync = ({ id, values }) => async (dispatch) => {
  const url = `/api/mirrors/${id}`;
  const res = await http.put(url, values);
  dispatch(setMirrors({ mirrors: [res.data] }));
};

export const deleteMirrorsAsync = ({ ids }) => async (dispatch) => {
  const url = `/api/mirrors?ids=${ids.join(',')}`;
  await http.delete(url);
  dispatch(removeMirrors({ ids }));
};

export const getSourceWorkspacesAsync = ({ serviceUrl, apiKeySecret }) => async (dispatch) => {
  const url = `/api/source-workspaces`;
  const res = await http.post(url, { serviceUrl, apiKeySecret });
  dispatch(setSourceWorkspaces({ workspaces: res.data }));
};

export const runMirrorAsync = ({ mirrorId }) => async (dispatch) => {
  dispatch(startRun());
  const url = `/api/mirror-executions`;
  const res = await http.post(url, { mirrorId });
  dispatch(setPreview({ preview: res.data }));
};

export const confirmMirrorAsync = ({ mirrorId, conflictActions, dryRun }) => async (dispatch) => {
  dispatch(startRun());
  const url = `/api/mirror-executions/confirm`;
  const res = await http.post(url, { mirrorId, conflictActions, dryRun });
  dispatch(setPreview({ preview: res.data }));
};

export const selectLoaded = (state) => state.mirrors.loaded;

export const selectLoading = (state) => state.mirrors.loading;

export const selectMirrors = (state) => state.mirrors.mirrors;

export const selectSourceWorkspaces = (state) => state.mirrors.sourceWorkspaces;

export const selectSourceWorkspacesLoaded = (state) => state.mirrors.sourceWorkspacesLoaded;

export const selectSourceWorkspacesLoading = (state) => state.mirrors.sourceWorkspacesLoading;

export const selectPreview = (state) => state.mirrors.preview;

export const selectRan = (state) => state.mirrors.ran;

export const selectRunning = (state) => state.mirrors.running;

export default mirrorsSlice.reducer;
