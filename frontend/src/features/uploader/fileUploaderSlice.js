import { createSlice } from '@reduxjs/toolkit';

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

export const fileUploadAsync = (file, source) => async (dispatch) => {
  dispatch(startUpload());
  try {
    const form = new FormData();
    form.append('sourceId', source.id);
    form.append('file', file.originFileObj);
    await http.post('/api/upload', form, {
      headers: {}
    });
    dispatch(uploaded());
  } catch (err) {
    return new Error(err.message);
  }
};

export const getUploadsAsync = ({ sourceId }) => async (dispatch) => {
  dispatch(startLoad());
  const url = `/api/workspaces/${sourceId}/uploads`;
  const res = await http.get(url);
  dispatch(setUploads({ sourceId, uploads: res.data }));
};

export const getUploadAsync = (id) => async (dispatch) => {
  dispatch(startLoad());
  const url = `/api/uploads/${id}`;
  const res = await http.get(url);
  dispatch(setUploads({ uploads: [res.data] }));
};

export const getUploadContentAsync = (sourceId, id) => async (dispatch, getState) => {
  const { uploads } = getState().fileUploader;
  dispatch(startLoad());
  const url = `/api/uploads/${id}/content`;
  const res = await http.get(url);
  const sourceUploads = [...uploads[sourceId]];
  const idx = sourceUploads.findIndex((u) => u.id === id);
  sourceUploads.splice(idx, 1, { ...sourceUploads[idx], content: res.data });
  dispatch(setUploads({ sourceId, uploads: sourceUploads }));
};

export const deleteUploadsAsync = ({ sourceId, uploads }) => async (dispatch) => {
  const names = uploads.map((u) => u.name);
  const url = `/api/uploads?names=${names.join(',')}`;
  await http.delete(url);
  dispatch(removeUploads({ sourceId, uploads }));
};

export const selectLoaded = (state) => state.fileUploader.loaded;

export const selectLoading = (state) => state.fileUploader.loading;

export const selectProcessed = (state) => state.fileUploader.processed;

export const selectProcessing = (state) => state.fileUploader.processing;

export const selectUploads = (state) => state.fileUploader.uploads;

export const selectUploaded = (state) => state.fileUploader.uploaded;

export const selectUploading = (state) => state.fileUploader.uploading;

export default fileUploaderSlice.reducer;
