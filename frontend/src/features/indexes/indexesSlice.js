import { createSlice } from '@reduxjs/toolkit';
import { flatten } from 'flat';

import { http } from '../../http';

export const indexesSlice = createSlice({
  name: 'indexes',
  initialState: {
    loaded: false,
    loading: false,
    indexes: {},
  },
  reducers: {
    removeIndexes: (state, action) => {
      for (const id of action.payload.ids) {
        delete state.indexes[id];
      }
    },
    resetIndexes: (state) => {
      state.indexes = {};
    },
    setIndexes: (state, action) => {
      for (const index of action.payload.indexes) {
        state.indexes[index.id] = index;
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
  removeIndexes,
  resetIndexes,
  setIndexes,
  startLoad,
} = indexesSlice.actions;

export const getIndexesAsync = ({ workspaceId }) => async (dispatch) => {
  dispatch(startLoad());
  dispatch(resetIndexes());
  const url = `/api/workspaces/${workspaceId}/indexes`;
  const res = await http.get(url);
  dispatch(setIndexes({ indexes: res.data }));
};

export const getIndexAsync = (id) => async (dispatch) => {
  dispatch(startLoad());
  const url = `/api/indexes/${id}`;
  const res = await http.get(url);
  const { name, nodeLabel, vectorStoreProvider, graphStoreProvider } = res.data;
  let index;
  if (vectorStoreProvider) {
    try {
      const res1 = await http.get(`/api/index/${vectorStoreProvider}/${name}?nodeLabel=${nodeLabel}`);
      if (vectorStoreProvider === 'redis') {
        const {
          attributes,
          numDocs,
          numRecords,
          numTerms,
          recordsPerDocAvg,
        } = res1.data;
        index = {
          ...res.data,
          store: {
            attributes,
            numDocs,
            numRecords,
            numTerms,
            recordsPerDocAvg,
          },
        };
      } else if (vectorStoreProvider === 'neo4j') {
        const {
          indexName,
          embeddingDimension,
          similarityMetric,
          nodeLabel,
          numDocs,
        } = res1.data;
        index = {
          ...res.data,
          store: {
            indexName,
            embeddingDimension,
            similarityMetric,
            nodeLabel,
            numDocs,
          },
        };
      } else if (vectorStoreProvider === 'chroma') {
        const {
          id,
          name,
          metadata,
          numDocs,
        } = res1.data;
        const {
          embeddingDimension,
          embeddingNodeProperty,
          similarityMetric,
          nodeLabel,
        } = (metadata || {});
        index = {
          ...res.data,
          store: {
            indexId: id,
            indexName: name,
            embeddingDimension,
            embeddingNodeProperty,
            similarityMetric,
            nodeLabel,
            numDocs,
          },
        };
      } else if (vectorStoreProvider === 'elasticsearch') {
        // TODO - move to server
        const {
          mappings,
          settings,
        } = res1.data[name];
        const attributes = Object.entries(flatten(getProperties(mappings.properties)))
          .map(([k, v]) => {
            const attribute = nodeLabel + '__' + k.replace('.', '__');
            return { attribute, type: v };
          });
        index = {
          ...res.data,
          store: {
            indexId: settings.index.uuid,
            indexName: name,
            attributes,
            numDocs: res1.data.numDocs.count,
          },
        };
      }
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      console.error(message);
      // index probably doesn't exist
      index = res.data;
    }
  } else {
    index = res.data;
  }
  dispatch(setIndexes({ indexes: [index] }));
};

export const createIndexAsync = ({ values }) => async (dispatch) => {
  const url = '/api/indexes';
  const res = await http.post(url, values);
  const index = { ...res.data, store: null };
  dispatch(setIndexes({ indexes: [index] }));
};

export const updateIndexAsync = ({ id, values }) => async (dispatch) => {
  const url = `/api/indexes/${id}`;
  const res = await http.put(url, values);
  dispatch(setIndexes({ indexes: [{ ...res.data, store: null }] }));
};

export const deleteIndexesAsync = ({ ids }) => async (dispatch) => {
  const url = `/api/indexes?ids=${ids.join(',')}`;
  await http.delete(url);
  dispatch(removeIndexes({ ids }));
};

export const createPhysicalIndexAsync = ({ id, name, schema, vectorStoreProvider, params }) => async (dispatch, getState) => {
  const indexes = getState().indexes.indexes;
  const currentIndex = indexes[id];
  const url = `/api/index`;
  const res = await http.post(url, { indexName: name, schema, vectorStoreProvider, params });
  const index = { ...currentIndex, store: res.data };
  dispatch(setIndexes({ indexes: [index] }));
};

export const dropPhysicalIndexAsync = ({ id, name, vectorStoreProvider }) => async (dispatch, getState) => {
  const indexes = getState().indexes.indexes;
  const currentIndex = indexes[id];
  const url = `/api/index/${vectorStoreProvider}/${name}`;
  await http.delete(url);
  const index = { ...currentIndex, store: null };
  dispatch(setIndexes({ indexes: [index] }));
};

export const dropDataAsync = ({ id, name, nodeLabel, vectorStoreProvider }) => async (dispatch, getState) => {
  const indexes = getState().indexes.indexes;
  const currentIndex = indexes[id];
  const url = `/api/index/${vectorStoreProvider}/${name}/data?nodeLabel=${nodeLabel}`;
  await http.delete(url);
  const index = {
    ...currentIndex, store: {
      ...currentIndex.store,
      numDocs: 0,
      numRecords: 0,
      numTerms: 0,
    }
  };
  dispatch(setIndexes({ indexes: [index] }));
};

export const dropGraphDataAsync = ({ graphStoreProvider, indexName }) => async () => {
  const url = `/api/graph-stores/${graphStoreProvider}?indexName=${indexName}`;
  await http.delete(url);
};

export const selectLoaded = (state) => state.indexes.loaded;

export const selectLoading = (state) => state.indexes.loading;

export const selectIndexes = (state) => state.indexes.indexes;

export default indexesSlice.reducer;

const getProperties = (props) => {
  if (!props) return {};
  const a = {};
  for (const [k, v] of Object.entries(props)) {
    if (v.properties) {
      a[k] = getProperties(v.properties);
    } else {
      a[k] = v.type;
    }
  }
  return a;
};