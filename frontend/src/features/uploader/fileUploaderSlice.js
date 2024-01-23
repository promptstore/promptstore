import omit from 'lodash.omit';
import { createSlice } from '@reduxjs/toolkit';
import { v4 as uuidv4 } from 'uuid';

import { http } from '../../http';
import { setCompositions } from '../composer/compositionsSlice';
import { setMessages } from '../designer/chatSlice';
import { setFunctions } from '../functions/functionsSlice';
import { setModels } from '../models/modelsSlice';
import { setPromptSets } from '../promptSets/promptSetsSlice';

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
    indexed: {},
    indexing: {},
  },
  reducers: {
    removeUploads: (state, action) => {
      const { workspaceId, uploads } = action.payload;
      state.uploads[workspaceId] = (state.uploads[workspaceId] || []).filter((u) => {
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
    startIndex: (state, action) => {
      state.indexing[action.payload.dataSourceId] = true;
      state.indexed[action.payload.dataSourceId] = false;
    },
    endIndex: (state, action) => {
      state.indexed[action.payload.dataSourceId] = true;
      state.indexing[action.payload.dataSourceId] = false;
    },
    resetIndexStatus: (state, action) => {
      state.indexed[action.payload.dataSourceId] = false;
      state.indexing[action.payload.dataSourceId] = false;
    },
  }
});

export const {
  removeUploads,
  setAppUploads,
  setUploads,
  startLoad,
  startUpload,
  uploaded,
  startReload,
  reloaded,
  resetIndexStatus,
  startIndex,
  endIndex,
} = fileUploaderSlice.actions;

export const fileUploadAsync = (workspaceId, file, isImage) => async (dispatch, getState) => {
  dispatch(startUpload());
  const correlationId = uuidv4();
  const form = new FormData();
  form.append('workspaceId', workspaceId);
  form.append('correlationId', correlationId);
  form.append('file', file.originFileObj);
  form.append('isImage', isImage);
  await http.post('/api/upload', form);
  const timeout = 120000;
  const start = new Date();
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
      if (isImage) {
        const { messages } = getState().chat;
        dispatch(setMessages({
          messages: [...messages, {
            key: uuidv4(),
            role: 'user',
            content: [
              {
                type: 'image_url',
                objectName: res.data.name,
                image_url: {
                  url: res.data.imageUrl,
                },
              },
            ],
          }]
        }));
      } else {
        const { uploads } = getState().fileUploader;
        dispatch(setUploads({
          workspaceId,
          uploads: [...uploads[workspaceId], upload],
        }));
      }
      dispatch(uploaded());
    } catch (err) {
      // 423 - locked ~ not ready
      if (err.response?.status !== 423) {
        clearInterval(intervalId);
      } else {
        const now = new Date();
        const diff = now - start;
        if (diff > timeout) {
          clearInterval(intervalId);
        }
      }
    }
  }, 5000);
};

export const objectUploadAsync = ({ file, type, workspaceId }) => async (dispatch) => {
  dispatch(startUpload());
  const form = new FormData();
  form.append('type', type);
  form.append('workspaceId', workspaceId);
  form.append('file', file.originFileObj);
  const res = await http.post('/api/object-uploads', form);
  if (type === 'promptSet') {
    dispatch(setPromptSets({ promptSets: res.data }));
  } else if (type === 'function') {
    dispatch(setFunctions({ functions: res.data }));
  } else if (type === 'model') {
    dispatch(setModels({ models: res.data }));
  } else if (type === 'composition') {
    dispatch(setCompositions({ compositions: res.data }));
  }
  dispatch(uploaded());
};

export const reloadContentAsync = ({ workspaceId, uploadId, filepath }) => async (dispatch, getState) => {
  dispatch(startReload({ uploadId }));
  const correlationId = uuidv4();
  const url = '/api/reload';
  await http.post(url, { correlationId, workspaceId, uploadId, filepath });
  const timeout = 120000;
  const start = new Date();
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
      } else {
        const now = new Date();
        const diff = now - start;
        if (diff > timeout) {
          clearInterval(intervalId);
        }
      }
    }
  }, 5000);
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
  // console.log('content:', content);
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

export const crawlAsync = ({ dataSourceId, params, workspaceId }) => async (dispatch) => {
  dispatch(startIndex({ dataSourceId }));
  const correlationId = uuidv4();
  await http.post('/api/index/crawler', { correlationId, params, workspaceId });
  const timeout = 120000;
  const start = new Date();
  const intervalId = setInterval(async () => {
    let res;
    try {
      res = await http.get('/api/index-status/' + correlationId);
      clearInterval(intervalId);
      // console.log('index status res:', res);
      dispatch(endIndex({ dataSourceId }));
    } catch (err) {
      // 423 - locked ~ not ready
      if (err.response.status !== 423) {
        clearInterval(intervalId);
      } else {
        const now = new Date();
        const diff = now - start;
        if (diff > timeout) {
          clearInterval(intervalId);
        }
      }
    }
  }, 5000);
};

export const indexApiAsync = ({ dataSourceId, params, workspaceId }) => async (dispatch) => {
  dispatch(startIndex({ dataSourceId }));
  const correlationId = uuidv4();
  const url = '/api/index/api';
  await http.post(url, { correlationId, params, workspaceId });
  const timeout = 120000;
  const start = new Date();
  const intervalId = setInterval(async () => {
    let res;
    try {
      res = await http.get('/api/index-status/' + correlationId);
      clearInterval(intervalId);
      // console.log('index status res:', res);
      dispatch(endIndex({ dataSourceId }));
    } catch (err) {
      // 423 - locked ~ not ready
      if (err.response.status !== 423) {
        clearInterval(intervalId);
      } else {
        const now = new Date();
        const diff = now - start;
        if (diff > timeout) {
          clearInterval(intervalId);
        }
      }
    }
  }, 5000);
};

export const indexCsvAsync = ({ dataSourceId, documents, params, workspaceId }) => async (dispatch) => {
  dispatch(startIndex({ dataSourceId }));
  const correlationId = uuidv4();
  const url = '/api/index/csv';
  await http.post(url, { correlationId, documents, params, workspaceId });
  const timeout = 120000;
  const start = new Date();
  const intervalId = setInterval(async () => {
    let res;
    try {
      res = await http.get('/api/index-status/' + correlationId);
      clearInterval(intervalId);
      // console.log('index status res:', res);
      dispatch(endIndex({ dataSourceId }));
    } catch (err) {
      // 423 - locked ~ not ready
      if (err.response.status !== 423) {
        clearInterval(intervalId);
      } else {
        const now = new Date();
        const diff = now - start;
        if (diff > timeout) {
          clearInterval(intervalId);
        }
      }
    }
  }, 5000);
};

export const indexDocumentAsync = ({ appId, dataSourceId, documents, params, workspaceId }) => async (dispatch) => {
  dispatch(startIndex({ dataSourceId }));
  const correlationId = uuidv4();
  const url = '/api/index/document';
  await http.post(url, { appId, correlationId, documents, params, workspaceId });
  const timeout = 120000;
  const start = new Date();
  const intervalId = setInterval(async () => {
    let res;
    try {
      res = await http.get('/api/index-status/' + correlationId);
      clearInterval(intervalId);
      // console.log('index status res:', res);
      dispatch(endIndex({ dataSourceId }));
    } catch (err) {
      // 423 - locked ~ not ready
      if (err.response.status !== 423) {
        clearInterval(intervalId);
      } else {
        const now = new Date();
        const diff = now - start;
        if (diff > timeout) {
          clearInterval(intervalId);
        }
      }
    }
  }, 5000);
};

export const indexGraphAsync = ({ dataSourceId, params, workspaceId }) => async (dispatch) => {
  dispatch(startIndex({ dataSourceId }));
  const correlationId = uuidv4();
  const url = '/api/index/graph';
  await http.post(url, { correlationId, params, workspaceId });
  const timeout = 120000;
  const start = new Date();
  const intervalId = setInterval(async () => {
    let res;
    try {
      res = await http.get('/api/index-status/' + correlationId);
      clearInterval(intervalId);
      // console.log('index status res:', res);
      dispatch(endIndex({ dataSourceId }));
    } catch (err) {
      // 423 - locked ~ not ready
      if (err.response.status !== 423) {
        clearInterval(intervalId);
      } else {
        const now = new Date();
        const diff = now - start;
        if (diff > timeout) {
          clearInterval(intervalId);
        }
      }
    }
  }, 5000);
};

export const indexTextDocumentAsync = ({ dataSourceId, documents, params, workspaceId }) => async (dispatch) => {
  dispatch(startIndex({ dataSourceId }));
  const correlationId = uuidv4();
  const url = '/api/index/text';
  await http.post(url, { correlationId, documents, params, workspaceId });
  const timeout = 120000;
  const start = new Date();
  const intervalId = setInterval(async () => {
    let res;
    try {
      res = await http.get('/api/index-status/' + correlationId);
      clearInterval(intervalId);
      // console.log('index status res:', res);
      dispatch(endIndex({ dataSourceId }));
    } catch (err) {
      // 423 - locked ~ not ready
      if (err.response.status !== 423) {
        clearInterval(intervalId);
      } else {
        const now = new Date();
        const diff = now - start;
        if (diff > timeout) {
          clearInterval(intervalId);
        }
      }
    }
  }, 5000);
};

export const indexWikipediaAsync = ({ dataSourceId, params, workspaceId }) => async (dispatch) => {
  dispatch(startIndex({ dataSourceId }));
  const correlationId = uuidv4();
  const url = '/api/index/wikipedia';
  await http.post(url, { correlationId, params, workspaceId });
  const timeout = 120000;
  const start = new Date();
  const intervalId = setInterval(async () => {
    let res;
    try {
      res = await http.get('/api/index-status/' + correlationId);
      clearInterval(intervalId);
      // console.log('index status res:', res.data);
      dispatch(endIndex({ dataSourceId }));
    } catch (err) {
      // 423 - locked ~ not ready
      if (err.response.status !== 423) {
        clearInterval(intervalId);
      } else {
        const now = new Date();
        const diff = now - start;
        if (diff > timeout) {
          clearInterval(intervalId);
        }
      }
    }
  }, 5000);
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

export const selectIndexed = (state) => state.fileUploader.indexed;

export const selectIndexing = (state) => state.fileUploader.indexing;

export default fileUploaderSlice.reducer;
