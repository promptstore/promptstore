import { createSlice } from '@reduxjs/toolkit';

import { http } from '../../http';

export const workspacesSlice = createSlice({
  name: 'workspaces',
  initialState: {
    loaded: false,
    loading: false,
    workspaces: {},
  },
  reducers: {
    removeWorkspaces: (state, action) => {
      for (const id of action.payload.ids) {
        delete state.workspaces[id];
      }
    },
    setWorkspaces: (state, action) => {
      for (const workspace of action.payload.workspaces) {
        state.workspaces[workspace.id] = workspace;
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
  removeWorkspaces,
  setWorkspaces,
  startLoad,
} = workspacesSlice.actions;

export const getWorkspacesAsync = () => async (dispatch) => {
  dispatch(startLoad());
  const url = '/api/workspaces';
  const res = await http.get(url);
  dispatch(setWorkspaces({ workspaces: res.data }));
};

export const getWorkspaceAsync = (id) => async (dispatch) => {
  dispatch(startLoad());
  const url = `/api/workspaces/${id}`;
  const res = await http.get(url);
  dispatch(setWorkspaces({ workspaces: [res.data] }));
};

export const createWorkspaceAsync = ({ values }) => async (dispatch) => {
  const url = '/api/workspaces';
  const res = await http.post(url, values);
  dispatch(setWorkspaces({ workspaces: [res.data] }));
};

export const updateWorkspaceAsync = ({ id, values }) => async (dispatch) => {
  const url = `/api/workspaces/${id}`;
  const res = await http.put(url, values);
  dispatch(setWorkspaces({ workspaces: [res.data] }));
};

export const deleteWorkspacesAsync = ({ ids }) => async (dispatch) => {
  const url = `/api/workspaces?ids=${ids.join(',')}`;
  await http.delete(url);
  dispatch(removeWorkspaces({ ids }));
};

export const handleKeyAssignmentAsync = ({ workspaceId, apiKey, name }) => async (dispatch) => {
  const url = `/api/workspaces/${workspaceId}/keys`;
  const res = await http.post(url, { apiKey, name });
  console.log('updated workspace:', res.data);
  dispatch(setWorkspaces({ workspaces: [res.data] }));
};

export const revokeKeyAssignmentAsync = ({ workspaceId, ids }) => async (dispatch) => {
  const url = `/api/workspaces/${workspaceId}/keys?ids=${ids.join(',')}`;
  const res = await http.delete(url);
  dispatch(setWorkspaces({ workspaces: [res.data] }));
};

export const inviteMembersAsync = ({ workspaceId, invites }) => async (dispatch) => {
  const url = `/api/invites`;
  const res = await http.post(url, { workspaceId, invites });
  console.log('updated workspace:', res.data);
  dispatch(setWorkspaces({ workspaces: [res.data] }));
};

export const selectLoaded = (state) => state.workspaces.loaded;

export const selectLoading = (state) => state.workspaces.loading;

export const selectWorkspaces = (state) => state.workspaces.workspaces;

export default workspacesSlice.reducer;
