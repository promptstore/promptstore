import { createSlice } from '@reduxjs/toolkit';
import { AnyAction } from 'redux';
import { ThunkAction } from 'redux-thunk';
import cloneDeep from 'lodash/cloneDeep';
import { v4 as uuidv4 } from 'uuid';

import { RootState } from '../../app/store';
// import { http } from '../../http';
import http from 'axios';

import { createImagesAsync } from '../apps/Playground/imagesSlice';

const limit = 50;

export interface ViewerState {
  currentImageList: any[];
  detail: any;
  lastAction: string;
  lastParams: any;
  loadedAll: boolean;
  loading: boolean;
  previewImages: any;
  searchedBy: string;
  start: number;
  tokenData: any;
  treeLoaded: boolean;
  tree: any[];
  subtree: any[];
  generatedImages: any[];
  uploadSetting: any;
}

const initialState: ViewerState = {
  currentImageList: [],
  detail: {},
  lastAction: '',
  lastParams: {},
  loadedAll: false,
  loading: false,
  previewImages: {},
  searchedBy: '',
  start: 0,
  tokenData: {},
  treeLoaded: false,
  tree: [],
  subtree: [],
  generatedImages: [],
  uploadSetting: {},
};

const findNode = (tree: any[], nodeId: string): any => {
  const recurse = (subtree: any[]): any => {
    for (const node of subtree) {
      if (node.id === nodeId) {
        return node;
      }
      if (node.children) {
        const result = recurse(node.children);
        if (result) {
          return result;
        }
      }
    }
    return null;
  };
  return recurse(tree);
};

const viewerSlice = createSlice({
  name: 'viewer',
  initialState,
  reducers: {
    toggleSubtree: (state, action) => {
      const { nodeId, tree } = action.payload;
      const t = cloneDeep(tree);
      const node = findNode(t, nodeId);
      if (node) {
        node.open = !node.open;
      }
      state.tree = t;
    },
    loadTree: (state, action) => {
      state.currentImageList = [];
      state.searchedBy = '';
      state.treeLoaded = false;
      const { nodeId, subtree, tree } = action.payload;
      if (nodeId) {
        const t = cloneDeep(tree);
        const node = findNode(t, nodeId);
        if (node) {
          node.children = subtree;
          node.loaded = true;
          node.loading = false;
          node.open = true;
        }
        state.tree = t;
      } else {
        state.tree = tree;
      }
    },
    loadTreeComplete: (state) => {
      state.treeLoaded = true;
    },
    loadSubtree: (state, action) => {
      state.subtree = action.payload.subtree;
    },
    loadingSubtree: (state, action) => {
      const { nodeId, tree } = action.payload;
      const t = cloneDeep(tree);
      const node = findNode(t, nodeId);
      if (node) {
        node.loaded = false;
        node.loading = true;
      }
      state.tree = t;
    },
    refreshImageList: (state, action) => {
      const { imageList, lastAction, lastParams, loadedAll, loadMore, start } = action.payload;
      if (loadMore) {
        state.currentImageList = [...state.currentImageList, ...imageList];
      } else {
        state.currentImageList = imageList;
      }
      state.lastAction = lastAction;
      state.lastParams = lastParams;
      state.loadedAll = loadedAll;
      state.start = start;
    },
    setDetail: (state, action) => {
      const { contentId, data } = action.payload;
      state.detail[contentId] = data;
    },
    setImage: (state, action) => {
      const { contentId, imageUrl } = action.payload;
      state.detail[contentId].imageUrl = imageUrl;
    },
    setPreviewImage: (state, action) => {
      const { contentId, imageUrl } = action.payload;
      state.previewImages[contentId] = imageUrl;
    },
    setTokenData: (state, action) => {
      state.tokenData = action.payload;
    },
    setUploadSetting: (state, action) => {
      state.uploadSetting = action.payload;
    },
    startLoad: (state, action) => {
      state.loading = true;
      if (!action.payload.loadMore) {
        state.start = 0;
      }
    },
    stopLoad: (state, action) => {
      state.loading = false;
    },
    startGeneration: (state, action) => {
      state.loading = true;
    },
    stopGeneration: (state, action) => {
      state.loading = false;
      state.generatedImages = action.payload.values;
    },
  },
});

export const {
  toggleSubtree,
  loadSubtree,
  loadTree,
  loadTreeComplete,
  loadingSubtree,
  refreshImageList,
  setDetail,
  setImage,
  setPreviewImage,
  setUploadSetting,
  setTokenData,
  startLoad,
  stopLoad,
  startGeneration,
  stopGeneration,
} = viewerSlice.actions;

export const initializeTokenData =
  (tokenData: any): ThunkAction<void, RootState, unknown, AnyAction> =>
    async (dispatch, getState) => {
      if (!tokenData.tenant) {
        const url = `https://oauth.canto.global/oauth/api/oauth2/tenant/${tokenData.refreshToken}`;
        const res = await http.get(url);
        const tenant = res.data;
        dispatch(setTokenData({ ...tokenData, tenant }));
      } else {
        dispatch(setTokenData(tokenData));
      }
    };

export const toggleSubtreeAsync =
  (nodeId: string): ThunkAction<void, RootState, unknown, AnyAction> =>
    async (dispatch, getState) => {
      const { tree } = getState().viewer;
      dispatch(toggleSubtree({ nodeId, tree }));
    };

export const loadTreeAsync =
  (): ThunkAction<void, RootState, unknown, AnyAction> =>
    async (dispatch, getState) => {
      try {
        const tokenData = getState().viewer.tokenData;
        const url = `https://${tokenData.tenant}/api/v1/tree?sortBy=name&sortDirection=ascending&layer=1`;
        const res = await http.get(url, {
          headers: getHeaders(tokenData),
        });
        const tree = res.data.results;
        dispatch(loadTree({ tree }));
      } catch (err) {
        console.error(err);
      }
    };

export const loadSubtreeAsync =
  (nodeId: string): ThunkAction<void, RootState, unknown, AnyAction> =>
    async (dispatch, getState) => {
      try {
        const tokenData = getState().viewer.tokenData;
        const url = `/api/v1/tree/${nodeId}?tenant=${tokenData.tenant}`;
        const res: any = await http.get(url, {
          headers: getHeaders(tokenData),
        });
        const subtree = res.results;
        dispatch(loadTree({ subtree }));
      } catch (err) {
        console.error(err);
      }
    };

export const loadMoreAsync =
  (): ThunkAction<void, RootState, unknown, AnyAction> =>
    async (dispatch, getState) => {
      const { lastAction, lastParams } = getState().viewer;
      if (lastAction === 'getListByAlbumAsync') {
        dispatch(getListByAlbumAsync({ ...lastParams, loadMore: true }));
      } else if (lastAction === 'getListByFilterAsync') {
        dispatch(getListByFilterAsync({ ...lastParams, loadMore: true }));
      }
    };

export const getListByAlbumAsync =
  ({ albumId, loadMore }: any): ThunkAction<void, RootState, unknown, AnyAction> =>
    async (dispatch, getState) => {
      console.log(`getListByAlbumAsync [albumId=${albumId}]`);
      try {
        dispatch(startLoad({ loadMore }));
        const { start, tokenData } = getState().viewer;
        const filterQueryString = loadMoreHandler({ start });
        console.log('filterQueryString:', filterQueryString);
        const url = `/api/v1/album/${albumId}?${filterQueryString}&tenant=${tokenData.tenant}`;
        const res = await http.get(url, {
          headers: getHeaders(tokenData),
        });
        const data = res.data;
        const imageList = data.results || [];
        const dataFound = data.found || 0;
        const dataStart = data.start || 0;
        dispatch(refreshImageList({
          imageList,
          loadedAll: dataFound - data.limit <= dataStart,
          start: dataStart + data.limit + 1,
          lastAction: 'getListByAlbumAsync',
          lastParams: { albumId },
          loadMore,
        }));
        for (const m of imageList) {
          dispatch(getPreviewImageAsync(m.id, m.url.preview));
        }
        // allow time for images to display
        setTimeout(() => dispatch(stopLoad({})), 2000);
      } catch (err) {
        console.error(err);
      }
    };

export const getListByFilterAsync =
  ({ keywords, loadMore, scheme }: any): ThunkAction<void, RootState, unknown, AnyAction> =>
    async (dispatch, getState) => {
      console.log(`getListByFilterAsync [scheme=${scheme}; keywords=${keywords}]`);
      try {
        dispatch(startLoad({ loadMore }));
        const { start, tokenData } = getState().viewer;
        const filterQueryString = loadMoreHandler({ start });
        console.log('filterQueryString:', filterQueryString);
        let url = `/api/v1/search?${filterQueryString}&keyword=${keywords}&tenant=${tokenData.tenant}`;
        if (scheme === 'allfile') {
          url += '&scheme=' + encodeURIComponent('image|presentation|document|audio|video|other');
        } else {
          url += '&scheme=' + scheme;
        }
        const res = await http.get(url, {
          headers: getHeaders(tokenData),
        });
        const data = res.data;
        const imageList = data.results || [];
        const dataFound = data.found || 0;
        const dataStart = data.start || 0;
        dispatch(refreshImageList({
          imageList,
          loadedAll: dataFound - data.limit <= dataStart,
          start: dataStart + data.limit + 1,
          lastAction: 'getListByFilterAsync',
          lastParams: { keywords, scheme },
          loadMore,
        }));
        for (const m of imageList) {
          dispatch(getPreviewImageAsync(m.id, m.url.preview));
        }
        // allow time for images to display
        setTimeout(() => dispatch(stopLoad({})), 2000);
      } catch (err) {
        console.error(err);
      }
    };

export const getListBySchemeAsync =
  ({ nodeId, scheme }: any): ThunkAction<void, RootState, unknown, AnyAction> =>
    async (dispatch, getState) => {
      console.info(`getListBySchemeAsync [scheme=${scheme}; nodeId=${nodeId}]`);
      const { start, tokenData, tree } = getState().viewer;
      try {
        if (scheme === 'allfile') {
          console.log('allfile');
          dispatch(getListByFilterAsync({ keywords: '', scheme }));

        } else if (scheme === 'subtree') {
          dispatch(loadingSubtree({ nodeId, tree }));
          const url = `/api/v1/tree/${nodeId}?sortBy=name&sortDirection=ascending&layer=1&tenant=${tokenData.tenant}`;
          const res: any = await http.get(url, {
            headers: getHeaders(tokenData),
          });
          const subtree = res.data.results;
          dispatch(loadTree({ nodeId, subtree, tree }));

        } else if (scheme === 'album') {
          console.log('album');
          dispatch(getListByAlbumAsync({ albumId: nodeId }));

        } else {
          const filterQueryString = loadMoreHandler({ start });
          let url = `/api/v1/scheme?${filterQueryString}&tenant=${tokenData.tenant}`;
          const res: any = await http.get(url, {
            headers: getHeaders(tokenData),
          });
          const data = res.data;
          const imageList = data.results;
          const dataStart = data.start || 0;
          dispatch(refreshImageList({
            imageList,
            loadedAll: data.found - data.limit <= dataStart,
            start: dataStart + data.limit + 1,
          }));
          for (const m of imageList) {
            dispatch(getPreviewImageAsync(m.id, m.url.preview));
          }
        }
      } catch (err) {
        console.error(err);
      }
    };

export const getDetailAsync =
  ({ contentId, previewUrl, scheme }: any): ThunkAction<void, RootState, unknown, AnyAction> =>
    async (dispatch, getState) => {
      console.info('getDetailAsync');
      try {
        const tokenData = getState().viewer.tokenData;
        const url = `/api/v1/${scheme}/${contentId}?tenant=${tokenData.tenant}`;
        const res = await http.get(url, {
          headers: getHeaders(tokenData),
        });
        dispatch(setDetail({ contentId, data: res.data }));
        dispatch(getImageAsync(contentId, previewUrl));
      } catch (err) {
        console.error(err);
      }
    };

export const getPreviewImageAsync =
  (contentId: string, previewUrl: string): ThunkAction<void, RootState, unknown, AnyAction> =>
    async (dispatch, getState) => {
      if (!previewUrl || !contentId) return;
      const tokenData = getState().viewer.tokenData;
      const url = previewUrl + 'URI';
      const res = await http.get(url, {
        headers: getHeaders(tokenData),
      });
      dispatch(setPreviewImage({ contentId, imageUrl: res.data }));
    };

export const getImageAsync =
  (contentId: string, previewUrl: string): ThunkAction<void, RootState, unknown, AnyAction> =>
    async (dispatch, getState) => {
      if (!previewUrl || !contentId) return;
      const tokenData = getState().viewer.tokenData;
      const url = previewUrl + 'URI/2000';
      const res = await http.get(url, {
        headers: getHeaders(tokenData),
      });
      dispatch(setImage({ contentId, imageUrl: res.data }));
    };

export const insertImageAsync =
  (imageArray: any[]): ThunkAction<void, RootState, unknown, AnyAction> =>
    async (dispatch, getState) => {
      if (!(imageArray && imageArray.length)) {
        return;
      }
      try {
        const tokenData = getState().viewer.tokenData;
        const url = `/api_binary/v1/batch/directuri&tenant=${tokenData.tenant}`;
        const res: any = await http.post(url, {
          headers: getHeaders(tokenData),
          data: JSON.stringify(imageArray),
        });
        for (let i = 0; i < res.length; i++) {
          for (let j = 0; j < imageArray.length; j++) {
            if (res[i].id === imageArray[j].id) {
              res[i].size = imageArray[j].size;
            }
          }
        }
        return {
          type: 'cantoInsertImage',
          appList: res,
        };
      } catch (err) {
        console.error(err);
      }
    };

export const generateImageVariantAsync =
  (appId: string, imageUrl: string): ThunkAction<void, RootState, unknown, AnyAction> =>
    async (dispatch, getState) => {
      if (!imageUrl || !appId) return;
      dispatch(startGeneration({}));
      const url = '/api/gen-image-variant';
      const res = await http.post(url, { imageUrl }, {
        headers: {},
      });
      console.log('res:', res.data);
      let values = [
        {
          appId,
          contentId: null,
          imageId: uuidv4(),
          imageUrl,
        },
      ];
      values = [
        ...values,
        ...res.data.map((m: any) => ({
          appId,
          contentId: null,
          imageId: uuidv4(),
          imageUrl: m.url,
          params: {
            originalImageUrl: imageUrl,
          },
        }))
      ];
      dispatch(createImagesAsync({ values }));
      dispatch(stopGeneration({ values }));
    };

export const getUploadSettingAsync =
  (): ThunkAction<void, RootState, unknown, AnyAction> =>
    async (dispatch, getState) => {
      const tokenData = getState().viewer.tokenData;
      const url = '/api/v1/upload/setting';
      const res = await http.get(url, {
        headers: getHeaders(tokenData),
      });
      dispatch(setUploadSetting(res.data));
    };

const getHeaders = ({ accessToken, tokenType }: any) => ({
  'Authorization': tokenType + ' ' + accessToken,
  'Content-Type': 'application/x-www-form-urlencoded',
});

const loadMoreHandler = ({ start }: any) => {
  const filterQueryString = `sortBy=time&sortDirection=descending&limit=${limit}&start=${start}`;
  return filterQueryString;
}

export const selectDetail = (state: RootState) => state.viewer.detail;

export const selectImageList = (state: RootState) => state.viewer.currentImageList;

export const selectLoadedAll = (state: RootState) => state.viewer.loadedAll;

export const selectLoading = (state: RootState) => state.viewer.loading;

export const selectPreviewImages = (state: RootState) => state.viewer.previewImages;

export const selectTokenData = (state: RootState) => state.viewer.tokenData;

export const selectTree = (state: RootState) => state.viewer.tree;

export const selectGeneratedImages = (state: RootState) => state.viewer.generatedImages;

export const selectIsLoggedIn = (state: RootState) => !!state.viewer.tokenData?.accessToken;

export default viewerSlice.reducer;
