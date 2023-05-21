import { createSlice } from '@reduxjs/toolkit';
import { v4 as uuidv4 } from 'uuid';
import omit from 'lodash.omit';

import { http } from '../../../http';

export const imagesSlice = createSlice({
  name: 'images',
  initialState: {
    loaded: false,
    loading: false,
    images: {},

  },
  reducers: {
    removeImages: (state, action) => {
      for (const key of action.payload.keys) {
        delete state.images[key];
      }
    },
    resetImages: (state, action) => {
      state.images = {};
    },
    setImages: (state, action) => {
      for (const item of action.payload.images) {
        state.images[item.imageId] = item;
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
  removeImages,
  resetImages,
  setImages,
  startLoad,
} = imagesSlice.actions;

export const getImagesAsync = ({ appId }) => async (dispatch) => {
  dispatch(startLoad());
  dispatch(resetImages());
  let url, res;
  url = `/api/apps/${appId}/images`;
  res = await http.get(url);
  let images = res.data;
  const objectNames = images.map((im) => im.objectName);
  url = `/api/presignedurls`;
  res = await http.post(url, { objectNames });
  const presignedUrls = res.data;
  images = images.map((im, i) => ({
    ...im,
    imageUrl: presignedUrls[i],
  }));
  dispatch(setImages({ images }));
};

export const getContentImagesAsync = ({ contentId }) => async (dispatch) => {
  dispatch(startLoad());
  dispatch(resetImages());
  let url, res;
  url = `/api/content/${contentId}/images`;
  res = await http.get(url);
  let images = res.data;
  const objectNames = images.map((im) => im.objectName);
  url = `/api/presignedurls`;
  res = await http.post(url, { objectNames });
  const presignedUrls = res.data;
  images = images.map((im, i) => ({
    ...im,
    imageUrl: presignedUrls[i],
  }));
  dispatch(setImages({ images }));
};

export const getImageAsync = (id) => async (dispatch) => {
  dispatch(startLoad());
  let url, res;
  url = `/api/image/${id}`;
  res = await http.get(url);
  let image = res.data;
  url = `/api/presignedurls`;
  res = await http.post(url, { objectNames: [image.objectName] });
  const presignedUrls = res.data;
  image = {
    ...image,
    imageUrl: presignedUrls[0],
  };
  dispatch(setImages({ images: [image] }));
};

export const createImagesAsync = ({ values }) => async (dispatch, getState) => {
  if (values.length) {
    const { tokenData } = getState().viewer;
    values = values.map((v) => omit(v, ['isNew', 'isChanged']));
    const url = '/api/bulk-images';
    const res = await http.post(url, { images: values, tokenData });
    const ids = res.data;
    const images = values.map((v, i) => ({ ...v, id: ids[i] }));
    dispatch(setImages({ images }));
  }
};

export const createImageAsync = ({ values }) => async (dispatch) => {
  const url = '/api/images';
  const res = await http.post(url, values);
  dispatch(setImages({ images: [{ ...values, id: res.data }] }));
};

export const updateImagesAsync = ({ values }) => async (dispatch) => {
  if (values.length) {
    const url = `/api/images`;
    await http.put(url, values);
    dispatch(setImages({ images: values }));
  }
};

export const updateImageAsync = ({ id, values }) => async (dispatch) => {
  const url = `/api/images/${id}`;
  await http.put(url, values);
  dispatch(setImages({ images: [values] }));
};

export const deleteImagesAsync = ({ keys }) => async (dispatch, getState) => {
  const { images } = getState().images;
  const ids = keys.map((key) => images[key].id).filter((id) => typeof id !== 'undefined');
  if (ids.length) {
    const url = `/api/images?ids=${ids.join(',')}`;
    await http.delete(url);
  }
  dispatch(removeImages({ keys }));
};

export const generateImageAsync = (appId, contentId, params) => async (dispatch) => {
  dispatch(startLoad());
  const url = '/api/image-request';
  const res = await http.post(url, params);
  const images = res.data.map(({ imageUrl, objectName }) => ({
    appId,
    contentId,
    imageId: uuidv4(),
    imageUrl,
    isNew: true,
    objectName,
    params,
  }));
  dispatch(setImages({ images }));
};

export const findImageAsync = (appId, contentId, params) => async (dispatch) => {
  dispatch(startLoad());
  const url = '/api/image-search';
  const res = await http.post(url, params);
  const images = res.data.map(({ imageUrl, objectName }) => ({
    appId,
    contentId,
    imageId: uuidv4(),
    imageUrl,
    isNew: true,
    objectName,
    params,
  }));
  dispatch(setImages({ images }));
};

export const selectLoaded = (state) => state.images.loaded;

export const selectLoading = (state) => state.images.loading;

export const selectImages = (state) => state.images.images;

export default imagesSlice.reducer;
