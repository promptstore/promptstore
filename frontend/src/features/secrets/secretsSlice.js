import { createSlice } from '@reduxjs/toolkit';

import { http } from '../../http';

export const secretsSlice = createSlice({
  name: 'secrets',
  initialState: {
    loaded: false,
    loading: false,
    secrets: {},
  },
  reducers: {
    removeSecrets: (state, action) => {
      for (const id of action.payload.ids) {
        delete state.secrets[id];
      }
    },
    setSecrets: (state, action) => {
      for (const secret of action.payload.secrets) {
        state.secrets[secret.id] = secret;
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
  removeSecrets,
  setSecrets,
  startLoad,
} = secretsSlice.actions;

export const getSecretsAsync = ({ workspaceId }) => async (dispatch) => {
  dispatch(startLoad());
  let url = `/api/workspaces/${workspaceId}/secrets`;
  const res = await http.get(url);
  dispatch(setSecrets({ secrets: res.data }));
};

export const getSecretAsync = (id) => async (dispatch) => {
  dispatch(startLoad());
  const url = `/api/secrets/${id}`;
  const res = await http.get(url);
  dispatch(setSecrets({ secrets: [res.data] }));
};

export const getSecretByNameAsync = ({ name, workspaceId }) => async (dispatch) => {
  dispatch(startLoad());
  const url = `/api/workspaces/${workspaceId}/secrets-by-name/${encodeURIComponent(name)}`;
  const res = await http.get(url);
  dispatch(setSecrets({ secrets: [res.data] }));
};

export const createSecretAsync = ({ values }) => async (dispatch) => {
  const url = '/api/secrets';
  const res = await http.post(url, values);
  dispatch(setSecrets({ secrets: [res.data] }));
};

export const updateSecretAsync = ({ id, values }) => async (dispatch) => {
  const url = `/api/secrets/${id}`;
  const res = await http.put(url, values);
  dispatch(setSecrets({ secrets: [res.data] }));
};

export const deleteSecretsAsync = ({ ids }) => async (dispatch) => {
  const url = `/api/secrets?ids=${ids.join(',')}`;
  await http.delete(url);
  dispatch(removeSecrets({ ids }));
};

export const selectLoaded = (state) => state.secrets.loaded;

export const selectLoading = (state) => state.secrets.loading;

export const selectSecrets = (state) => state.secrets.secrets;

export default secretsSlice.reducer;
