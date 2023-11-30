import omit from 'lodash.omit';
import { createSlice } from '@reduxjs/toolkit';
import { v4 as uuidv4 } from 'uuid';

import { http } from '../../http';

export const appUploaderSlice = createSlice({
  name: 'appUploader',
  initialState: {
    loaded: false,
    loading: false,
    uploads: {},
    uploaded: false,
    uploading: false,
  },
  reducers: {
    removeUploads: (state, action) => {
      const { appId, uploads } = action.payload;
      state.uploads[appId] = (state.uploads[appId] || []).filter((u) => {
        for (const upload of uploads) {
          if (u.etag === upload.etag) {
            return false;
          }
        }
        return true;
      });
    },
    setUploads: (state, action) => {
      const { appId, uploads } = action.payload;
      state.uploads[appId] = uploads;
      state.loaded = true;
      state.loading = false;
    },
    startLoad: (state) => {
      state.loaded = false;
      state.loading = true;
    },
    startUpload: (state) => {
      state.uploading = true;
      state.uploaded = false;
    },
    uploaded: (state) => {
      state.uploaded = true;
      state.uploading = false;
    },
  }
});

export const {
  removeUploads,
  setUploads,
  startLoad,
  startUpload,
  uploaded,
} = appUploaderSlice.actions;

export const fileUploadAsync = (workspaceId, appId, file) => async (dispatch, getState) => {
  dispatch(startUpload());
  const correlationId = uuidv4();
  const form = new FormData();
  form.append('workspaceId', workspaceId);
  form.append('appId', appId);
  form.append('correlationId', correlationId);
  form.append('file', file.originFileObj);
  await http.post('/api/upload', form);
  const intervalId = setInterval(async () => {
    let res;
    try {
      res = await http.get('/api/upload-status/' + correlationId);
      clearInterval(intervalId);
      // console.log('upload status res:', res);
      const upload = {
        ...omit(res.data, ['data']),
        content: res.data.data,
      };
      const { uploads } = getState().appUploader;
      dispatch(setUploads({
        appId,
        uploads: [...uploads[appId], upload],
      }));
      dispatch(uploaded());
    } catch (err) {
      // 423 - locked ~ not ready
      if (err.response?.status !== 423) {
        clearInterval(intervalId);
      }
    }
  }, 2000);
};

const fetchUploads = async (appId) => {
  const url = `/api/apps/${appId}/uploads`;
  const res = await http.get(url);
  return res.data;
};

export const getUploadsAsync = ({ appId }) => async (dispatch) => {
  const uploads = await fetchUploads(appId);
  dispatch(setUploads({ appId, uploads }));
};

const getNewUploads = (current, id, content) => {
  if (!current) return null;
  const index = current.findIndex((u) => u.id === id);
  if (index === -1) return null;
  const upload = current[index];
  const uploads = [...current];
  uploads.splice(index, 1, { ...upload, content });
  return uploads;
};

export const getUploadContentAsync = (appId, id, maxBytes) => async (dispatch, getState) => {
  const { uploads } = getState().appUploader;
  dispatch(startLoad());
  let url = `/api/uploads/${id}/content`;
  if (maxBytes) {
    url += `?maxbytes=${maxBytes}`;
  }
  const res = await http.get(url);
  const content = res.data || { data: { structured_content: [{ type: 'text', text: 'None' }] } };
  // console.log('content:', content);
  let newUploads = getNewUploads(uploads[appId], id, content);
  if (!newUploads) {
    const sourceUploads = await fetchUploads(appId);
    newUploads = getNewUploads(sourceUploads, id, content);
  }
  dispatch(setUploads({ appId, uploads: newUploads }));
};

export const deleteUploadsAsync = ({ workspaceId, appId, uploads }) => async (dispatch) => {
  const names = uploads.map((u) => u.name);
  const url = `/api/uploads?workspace=${workspaceId}&names=${names.join(',')}`;
  await http.delete(url);
  dispatch(removeUploads({ appId, uploads }));
};

export const selectLoaded = (state) => state.appUploader.loaded;

export const selectLoading = (state) => state.appUploader.loading;

export const selectUploads = (state) => state.appUploader.uploads;

export const selectUploaded = (state) => state.appUploader.uploaded;

export const selectUploading = (state) => state.appUploader.uploading;

export default appUploaderSlice.reducer;