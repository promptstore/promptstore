import omit from 'lodash.omit';
import { createSlice } from '@reduxjs/toolkit';
import { v4 as uuidv4 } from 'uuid';

import { http } from '../../http';

export const fileUploaderSlice = createSlice({
  name: 'fileUploader',
  initialState: {
    loaded: false,
    loading: false,
    uploads: {},
    uploaded: false,
    uploading: false,
    reloaded: {},
    reloading: {},
  },
  reducers: {
    removeUploads: (state, action) => {
      const { workspaceId, uploads } = action.payload;
      state.uploads[workspaceId] = state.uploads[workspaceId].filter((u) => {
        for (const upload of uploads) {
          if (u.etag === upload.etag) {
            return false;
          }
        }
        return true;
      });
    },
    setUploads: (state, action) => {
      const { workspaceId, uploads } = action.payload;
      state.uploads[workspaceId] = uploads;
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
    startReload: (state, action) => {
      state.reloading[action.payload.uploadId] = true;
      state.reloaded[action.payload.uploadId] = false;
    },
    reloaded: (state, action) => {
      state.reloaded[action.payload.uploadId] = true;
      state.reloading[action.payload.uploadId] = false;
    },
  }
});

export const {
  removeUploads,
  setUploads,
  startLoad,
  startUpload,
  uploaded,
  startReload,
  reloaded,
} = fileUploaderSlice.actions;

export const fileUploadAsync = (workspaceId, file) => async (dispatch, getState) => {
  dispatch(startUpload());
  const correlationId = uuidv4();
  const form = new FormData();
  form.append('workspaceId', workspaceId);
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
      const { uploads } = getState().fileUploader;
      dispatch(setUploads({
        workspaceId,
        uploads: [...uploads[workspaceId], upload],
      }));
      dispatch(uploaded());
    } catch (err) {
      // 423 - locked ~ not ready
      if (err.response.status !== 423) {
        clearInterval(intervalId);
      }
    }
  }, 2000);
};

export const reloadContentAsync = ({ workspaceId, uploadId, filepath }) => async (dispatch, getState) => {
  dispatch(startReload({ uploadId }));
  const correlationId = uuidv4();
  const url = '/api/reload';
  await http.post(url, { correlationId, workspaceId, uploadId, filepath });
  const intervalId = setInterval(async () => {
    let res;
    try {
      res = await http.get('/api/upload-status/' + correlationId);
      clearInterval(intervalId);
      // console.log('upload status res:', res);

      // set `content` on upload to null to force refetch when previewing
      const { uploads } = getState().fileUploader;
      let newUploads = getNewUploads(uploads[workspaceId], uploadId, null);
      if (!newUploads) {
        const sourceUploads = await fetchUploads(workspaceId);
        newUploads = getNewUploads(sourceUploads, uploadId, null);
      }
      dispatch(setUploads({ workspaceId, uploads: newUploads }));

      dispatch(reloaded({ uploadId }));
    } catch (err) {
      // 423 - locked ~ not ready
      if (err.response.status !== 423) {
        clearInterval(intervalId);
      }
    }
  }, 2000);
};

const fetchUploads = async (workspaceId) => {
  const url = `/api/workspaces/${workspaceId}/uploads`;
  const res = await http.get(url);
  return res.data;
};

export const getUploadsAsync = ({ workspaceId }) => async (dispatch) => {
  dispatch(startLoad());
  const uploads = await fetchUploads(workspaceId);
  dispatch(setUploads({ workspaceId, uploads }));
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

export const getUploadContentAsync = (workspaceId, id, maxBytes) => async (dispatch, getState) => {
  const { uploads } = getState().fileUploader;
  dispatch(startLoad());
  let url = `/api/uploads/${id}/content`;
  if (maxBytes) {
    url += `?maxbytes=${maxBytes}`;
  }
  const res = await http.get(url);
  const content = res.data || { data: { structured_content: [{ type: 'text', text: 'None' }] } };
  let newUploads = getNewUploads(uploads[workspaceId], id, content);
  if (!newUploads) {
    const sourceUploads = await fetchUploads(workspaceId);
    newUploads = getNewUploads(sourceUploads, id, content);
  }
  dispatch(setUploads({ workspaceId, uploads: newUploads }));
};

export const deleteUploadsAsync = ({ workspaceId, uploads }) => async (dispatch) => {
  const names = uploads.map((u) => u.name);
  const url = `/api/uploads?workspace=${workspaceId}&names=${names.join(',')}`;
  await http.delete(url);
  dispatch(removeUploads({ workspaceId, uploads }));
};

export const indexApiAsync = ({ endpoint, schema, params, workspaceId }) => async (dispatch) => {
  const url = '/api/loader/api';
  await http.post(url, { endpoint, schema, params, workspaceId });
};

export const indexGraphAsync = ({ params, workspaceId }) => async (dispatch) => {
  const url = '/api/loader/graph';
  await http.post(url, { params, workspaceId });
};

export const indexStructuredDocumentAsync = ({ documents, params, workspaceId }) => async (dispatch) => {
  const url = '/api/loader/structureddocument';
  await http.post(url, { documents, params, workspaceId });
};

export const indexDocumentAsync = ({ documents, params, workspaceId }) => async (dispatch) => {
  const url = '/api/loader/document';
  await http.post(url, { documents, params, workspaceId });
};

export const selectLoaded = (state) => state.fileUploader.loaded;

export const selectLoading = (state) => state.fileUploader.loading;

export const selectProcessed = (state) => state.fileUploader.processed;

export const selectProcessing = (state) => state.fileUploader.processing;

export const selectUploads = (state) => state.fileUploader.uploads;

export const selectUploaded = (state) => state.fileUploader.uploaded;

export const selectUploading = (state) => state.fileUploader.uploading;

export const selectReloaded = (state) => state.fileUploader.reloaded;

export const selectReloading = (state) => state.fileUploader.reloading;

export default fileUploaderSlice.reducer;
