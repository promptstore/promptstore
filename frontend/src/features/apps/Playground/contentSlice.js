import { createSlice } from '@reduxjs/toolkit';
import { v4 as uuidv4 } from 'uuid';
import cloneDeep from 'lodash.clonedeep';
import isEqual from 'lodash.isequal';
import omit from 'lodash.omit';

import { http } from '../../../http';

import { updateAppAsync } from '../appsSlice';

export const contentSlice = createSlice({
  name: 'content',
  initialState: {
    loaded: false,
    loading: false,
    content: {},
    expandedRowKeys: [],
    piiContent: null,
    undoQueue: [],
    undoIndex: -1,
  },
  reducers: {
    removeContents: (state, action) => {
      state.undoQueue.push(state.content);
      state.undoIndex += 1;
      for (const key of action.payload.keys) {
        delete state.content[key];
      }
    },
    resetContents: (state, action) => {
      state.content = {};
    },
    setContents: (state, action) => {
      state.undoQueue.push(state.content);
      state.undoIndex += 1;
      for (const item of action.payload.contents) {
        state.content[item.contentId] = item;
      }
      state.loaded = true;
      state.loading = false;
    },
    setExpandedRowKeys: (state, action) => {
      state.expandedRowKeys = [action.payload.key];
    },
    startLoad: (state) => {
      state.loaded = false;
      state.loading = true;
    },
    setLikes: (state, action) => {
      state.undoQueue.push(state.content);
      state.undoIndex += 1;
      const { contentId, likes } = action.payload;
      const item = state.content[contentId];
      if (item) {
        const newItem = { ...item, likes };
        if (!item.isNew) {
          newItem.isChanged = true;
        }
        state.content[contentId] = newItem;
      }
    },
    setPiiContent: (state, action) => {
      state.piiContent = action.payload.piiContent;
      state.loaded = true;
      state.loading = false;
    },
    setRating: (state, action) => {
      state.undoQueue.push(state.content);
      state.undoIndex += 1;
      const { key, rating } = action.payload;
      const item = state.content[key];
      if (item) {
        const newItem = { ...item, rating };
        state.content[key] = newItem;
      }
    },
    undoUpdate: (state, action) => {
      const { newContent, newIndex } = action.payload;
      state.content = newContent;
      state.undoIndex = newIndex;
    },
  }
});

export const {
  removeContents,
  resetContents,
  setContents,
  setExpandedRowKeys,
  startLoad,
  setLikes,
  setPiiContent,
  setRating,
  undoUpdate,
} = contentSlice.actions;

export const undoAsync = () => async (dispatch, getState) => {
  const { content, undoIndex, undoQueue } = getState().content;
  let newContent;
  let newIndex;
  if (undoIndex > 0) {
    newIndex = undoIndex - 1;
    newContent = cloneDeep(undoQueue[newIndex]);
    const ids = [];
    for (const [key, item] of Object.entries(content)) {
      let found = newContent[key];
      if (!found) {
        ids.push(item.id);
      }
    }
    if (ids.length) {
      const url = `/api/content?ids=${ids.join(',')}`;
      await http.delete(url);
    }
    const values = [];
    for (const [key, item] of Object.entries(newContent)) {
      let found = content[key];
      if (found && isEqual(item, found)) {
        continue;
      }
      if (item.isNew || item.isChanged) {
        continue;
      }
      values.push(item);
    }
    if (values.length) {
      const url = '/api/contents';
      const res = await http.post(url, values);
      const ids = res.data;
      values.forEach((v, i) => {
        newContent[v.contentId].id = ids[i];
      });
    }
    dispatch(undoUpdate({ newContent, newIndex }));
  }
};

export const redoAsync = () => async (dispatch, getState) => {
  const { content, undoIndex, undoQueue } = getState().content;
  let newContent;
  let newIndex;
  if (undoIndex < undoQueue.length - 1) {
    newIndex = undoIndex + 1;
    newContent = cloneDeep(undoQueue[newIndex]);
    const ids = [];
    for (const [key, item] of Object.entries(content)) {
      let found = newContent[key];
      if (!found) {
        ids.push(item.id);
      }
    }
    if (ids.length) {
      const url = `/api/content?ids=${ids.join(',')}`;
      await http.delete(url);
    }
    const values = [];
    for (const [key, item] of Object.entries(newContent)) {
      let found = content[key];
      if (found && isEqual(item, found)) {
        continue;
      }
      if (item.isNew || item.isChanged) {
        continue;
      }
      values.push(item);
    }
    if (values.length) {
      const url = '/api/contents';
      const res = await http.post(url, values);
      const ids = res.data;
      values.forEach((v, i) => {
        newContent[v.contentId].id = ids[i];
      });
    }
    dispatch(undoUpdate({ newContent, newIndex }));
  }
};

export const getContentsByFilterAsync = (req) => async (dispatch) => {
  dispatch(startLoad());
  dispatch(resetContents());
  const searchParams = new URLSearchParams(req).toString();
  const url = `/api/contents?${searchParams}`;
  const res = await http.get(url);
  dispatch(setContents({ contents: res.data }));
};

export const getContentsAsync = ({ appId }) => async (dispatch) => {
  dispatch(startLoad());
  dispatch(resetContents());
  const url = `/api/apps/${appId}/content`;
  const res = await http.get(url);
  dispatch(setContents({ contents: res.data }));
};

export const getContentAsync = (id) => async (dispatch) => {
  dispatch(startLoad());
  const url = `/api/content/${id}`;
  const res = await http.get(url);
  dispatch(setContents({ contents: [res.data] }));
};

export const createContentsAsync = ({ values }) => async (dispatch) => {
  if (values.length) {
    values = values.map((v) => omit(v, ['isNew', 'isChanged']));
    const url = '/api/contents';
    const res = await http.post(url, values);
    const ids = res.data;
    const contents = values.map((v, i) => ({ ...v, id: ids[i] }));
    dispatch(setContents({ contents }));
  }
};

export const createContentAsync = ({ values }) => async (dispatch) => {
  const url = '/api/content';
  delete values.isChanged;
  delete values.isNew;
  const res = await http.post(url, values);
  dispatch(setContents({ contents: [{ ...values, id: res.data }] }));
};

export const updateContentsAsync = ({ values, userId }) => async (dispatch) => {
  if (values.length) {
    values = values.map((v) => omit(v, ['isNew', 'isChanged']));
    const url = `/api/contents`;
    if (userId) {
      values = values.map((v) => ({ ...v, modifiedBy: userId }));
    }
    const res = await http.put(url, values);
    dispatch(setContents({ contents: res.data }));
  }
};

export const updateContentAsync = ({ id, values, userId }) => async (dispatch) => {
  const url = `/api/content/${id}`;
  if (userId) {
    values = { ...values, modifiedBy: userId };
  }
  const newContent = await http.put(url, values);
  dispatch(setContents({ contents: [newContent] }));
};

export const deleteContentsAsync = ({ keys }) => async (dispatch, getState) => {
  const { content } = getState().content;
  const ids = keys.map((key) => content[key].id).filter((id) => typeof id !== 'undefined');
  if (ids.length) {
    const url = `/api/content?ids=${ids.join(',')}`;
    await http.delete(url);
  }
  dispatch(removeContents({ keys }));
};

export const getResponseAsync = ({ appId, app, contentId, service, userId }) => async (dispatch) => {
  dispatch(startLoad());
  let res, url;

  if (app.prompt) {
    url = '/api/pii';
    res = await http.post(url, { inputs: app.prompt });
    const index = res.data.text.search(/<[^>]+>/);
    if (index > 0) {
      dispatch(setPiiContent({
        piiContent: { ...res.data, original: app.prompt },
      }));
      return;
    }

    // if (res.data?.length) {
    //   dispatch(setPiiContent({
    //     piiContent: { text: app.prompt, tags: res.data },
    //   }));
    //   return;
    // }

  }

  url = '/api/completion';
  res = await http.post(url, { app, service });
  let contents, tokenCount;
  if (app.variations?.key) {
    contents = res.data.flatMap(getContents({ appId, contentId, userId }));
    tokenCount = res.data.reduce((a, c) => a + c.usage.total_tokens, 0);
  } else {
    contents = getContents({ appId, contentId, userId })(res.data);
    tokenCount = res.data.usage.total_tokens;
  }
  const cost = tokenCount / 1000 * 0.002;

  // if (app.toneFileName) {
  //   contents = contents.slice(1);
  // }

  dispatch(setContents({ contents }));
  dispatch(updateAppAsync({
    id: appId,
    values: {
      cost: (app.cost || 0) + cost,
      tokenCount: (app.tokenCount || 0) + tokenCount,
    }
  }));
};

const getContents = ({ appId, contentId, userId }) => ({ choices, model, usage }) => choices.map((completion) => ({
  appId,
  contentId: contentId || uuidv4(),
  isNew: true,
  text: completion.message.content.trim(),
  prompt: completion.prompt.content,
  createdBy: userId,
  modifiedBy: userId,
  model,
  usage,
}));

export const generateCopyImageAsync = (appId, contentId, params) => async (dispatch, getState) => {
  const { content } = getState().content;
  const item = content[contentId];
  dispatch(startLoad());
  const url = '/api/image-request';
  const res = await http.post(url, params);
  const images = res.data.map(({ url }) => ({
    appId,
    contentId,
    imageId: uuidv4(),
    imageUrl: url,
    isNew: true,
    params,
  }));
  dispatch(setContents({
    contents: [
      {
        ...item,
        image: images[0],
        isChanged: true,
      }
    ]
  }));
  dispatch(setExpandedRowKeys({ key: contentId }));
};

export const searchClient = {
  async search(requests) {
    const url = '/api/search';
    const res = await http.post(url, { requests });
    return res.data;
  },
  async searchForFacetValues(requests) {
    const url = '/api/sffv';
    const res = await http.post(url, { requests });
    return res.data;
  },
};

export const selectLoaded = (state) => state.content.loaded;

export const selectLoading = (state) => state.content.loading;

export const selectContents = (state) => state.content.content;

export const selectExpandedRowKeys = (state) => state.content.expandedRowKeys;

export const selectPiiContent = (state) => state.content.piiContent;

export const selectUndoDisabled = (state) => state.content.undoIndex === 0;

export const selectRedoDisabled = (state) => state.content.undoIndex === state.content.undoQueue.length - 1;

export default contentSlice.reducer;
