import { createSlice } from '@reduxjs/toolkit';
import { v4 as uuidv4 } from 'uuid';
import omit from 'lodash.omit';

import { http } from '../../http';

export const fileUploaderSlice = createSlice({
  name: 'fileUploader',
  initialState: {
    loaded: false,
    loading: false,
    processed: false,
    processing: false,
    uploads: {},
    uploaded: false,
    uploading: false,
  },
  reducers: {
    removeUploads: (state, action) => {
      const { sourceId, uploads } = action.payload;
      state.uploads[sourceId] = state.uploads[sourceId].filter((u) => {
        for (const upload of uploads) {
          if (u.etag === upload.etag) {
            return false;
          }
        }
        return true;
      });
    },
    setUploads: (state, action) => {
      const { sourceId, uploads } = action.payload;
      state.uploads[sourceId] = uploads;
      state.loaded = true;
      state.loading = false;
    },
    startLoad: (state) => {
      state.loaded = false;
      state.loading = true;
    },
    startProcessing: (state) => {
      state.processed = false;
      state.processing = true;
    },
    endProcessing: (state) => {
      state.processed = true;
      state.processing = false;
    },
    startUpload: (state) => {
      state.uploading = true;
      state.uploaded = false;
    },
    uploaded: (state, action) => {
      state.uploaded = true;
      state.uploading = false;
    },
  }
});

export const {
  removeUploads,
  setUploads,
  startLoad,
  startProcessing,
  endProcessing,
  startUpload,
  uploaded,
} = fileUploaderSlice.actions;

export const processUploadsAsync = (sourceId) => async (dispatch) => {
  dispatch(startProcessing());
  const url = `/api/uploads/${sourceId}/process`;
  await http.post(url);
  dispatch(endProcessing());
};

export const fileUploadAsync = (file, source) => async (dispatch, getState) => {
  dispatch(startUpload());
  const correlationId = uuidv4();
  const form = new FormData();
  form.append('sourceId', source.id);
  form.append('correlationId', correlationId);
  form.append('file', file.originFileObj);
  await http.post('/api/upload', form);
  const intervalId = setInterval(async () => {
    let res;
    try {
      res = await http.get('/api/upload-status/' + correlationId);
      clearInterval(intervalId);
      console.log('get upload-status res:', res);
      const upload = {
        ...omit(res.data, ['data']),
        content: res.data.data,
      };
      const { uploads } = getState().fileUploader;
      dispatch(setUploads({
        sourceId: source.id,
        uploads: [...uploads[source.id], upload],
      }));
      dispatch(uploaded());
    } catch (err) {
      console.log(err);
      // 404 not ready
      if (!res.status === '400') {
        throw err;
      }
    }
  }, 2000);
};

export const reloadContentAsync = ({ sourceId, uploadId, filepath }) => async (dispatch, getState) => {
  const url = 'api/reload';
  await http.post(url, { sourceId, uploadId, filepath });
  // set `content` on upload to null to force refetch when previewing
  const { uploads } = getState().fileUploader;
  let newUploads = getNewUploads(uploads[sourceId], uploadId, null);
  if (!newUploads) {
    const workspaceUploads = await fetchUploads(sourceId);
    newUploads = getNewUploads(workspaceUploads, uploadId, null);
  }
  dispatch(setUploads({ sourceId, uploads: newUploads }));
};

const fetchUploads = async (workspaceId) => {
  const url = `/api/workspaces/${workspaceId}/uploads`;
  const res = await http.get(url);
  return res.data;
};

export const getUploadsAsync = ({ sourceId }) => async (dispatch) => {
  dispatch(startLoad());
  const uploads = await fetchUploads(sourceId);
  dispatch(setUploads({ sourceId, uploads }));
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
    url += `?maxBytes=${maxBytes}`;
  }
  const res = await http.get(url);
  const content = res.data || { data: { structured_content: [{ type: 'text', text: 'None' }] } };
  let newUploads = getNewUploads(uploads[workspaceId], id, content);
  if (!newUploads) {
    const workspaceUploads = await fetchUploads(workspaceId);
    newUploads = getNewUploads(workspaceUploads, id, content);
  }
  dispatch(setUploads({ sourceId: workspaceId, uploads: newUploads }));
};

export const deleteUploadsAsync = ({ sourceId, uploads }) => async (dispatch) => {
  const names = uploads.map((u) => u.name);
  const url = `/api/uploads?workspaceId=${sourceId}&names=${names.join(',')}`;
  await http.delete(url);
  dispatch(removeUploads({ sourceId, uploads }));
};

export const indexApiAsync = ({ endpoint, schema, params, workspaceId }) => async (dispatch) => {
  const url = '/api/loader/api';
  await http.post(url, { endpoint, schema, params, workspaceId });
};

export const indexStructuredDocumentAsync = ({ documents, params, workspaceId }) => async (dispatch) => {
  const url = '/api/loader/structureddocument';
  await http.post(url, { documents, params, workspaceId });
};

// export const indexStructuredDocumentAsync = ({ uploadId, params }) => async (dispatch) => {
//   const url = '/api/loader/structureddocument';
//   await http.post(url, { uploadId, params });
// };

export const indexDocumentAsync = ({ filepath, params, workspaceId }) => async (dispatch) => {
  const url = '/api/loader/document';
  await http.post(url, { filepath, params, workspaceId });
};

export const selectLoaded = (state) => state.fileUploader.loaded;

export const selectLoading = (state) => state.fileUploader.loading;

export const selectProcessed = (state) => state.fileUploader.processed;

export const selectProcessing = (state) => state.fileUploader.processing;

export const selectUploads = (state) => state.fileUploader.uploads;

export const selectUploaded = (state) => state.fileUploader.uploaded;

export const selectUploading = (state) => state.fileUploader.uploading;

export default fileUploaderSlice.reducer;
