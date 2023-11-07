import { JSONSchema7 } from 'json-schema';

import { Chunk } from '../core/indexers/Chunk';
import {
  CreateIndexParams,
  DropDataParams,
  GetIndexParams,
  GetNumberChunksParams,
  IndexChunksParams,
  SearchParams,
  VectorStore,
  VectorStoreEnum,
  VectorStoreService,
} from '../core/indexers/VectorStore';
import { PluginServiceParams } from '../core/indexers/Plugin';

export function VectorStoreService({ logger, registry }: PluginServiceParams): VectorStoreService {

  function getIndexes(vectorstore: VectorStoreEnum) {
    logger.debug('get indexes, vectorstore:', vectorstore);
    const instance = registry[vectorstore] as VectorStore;
    return instance.getIndexes();
  };

  function getIndex(vectorstore: VectorStoreEnum, indexName: string, params: GetIndexParams) {
    logger.debug('get index: %s, vectorstore:', indexName, vectorstore);
    const instance = registry[vectorstore] as VectorStore;
    return instance.getIndex(indexName, params);
  };

  function createIndex(vectorstore: VectorStoreEnum, indexName: string, schema: JSONSchema7, params: CreateIndexParams) {
    logger.debug('create index: %s, vectorstore:', indexName, vectorstore);
    const instance = registry[vectorstore] as VectorStore;
    return instance.createIndex(indexName, schema, params);
  };

  function dropIndex(vectorstore: VectorStoreEnum, indexName: string) {
    logger.debug('drop index: %s, vectorstore:', indexName, vectorstore);
    const instance = registry[vectorstore] as VectorStore;
    return instance.dropIndex(indexName);
  };

  function getNumberChunks(vectorstore: VectorStoreEnum, indexName: string, params: GetNumberChunksParams) {
    logger.debug('get number chunks from index: %s, vectorstore:', indexName, vectorstore);
    const instance = registry[vectorstore] as VectorStore;
    return instance.getNumberChunks(indexName, params);
  };

  function dropData(vectorstore: VectorStoreEnum, indexName: string, params: DropDataParams) {
    logger.debug('drop data from index: %s, vectorstore:', indexName, vectorstore);
    const instance = registry[vectorstore] as VectorStore;
    return instance.dropData(indexName, params);
  };

  function indexChunks(vectorstore: VectorStoreEnum, chunks: Chunk[], embeddings: number[], params: IndexChunksParams) {
    logger.debug('index chunks, vectorstore:', vectorstore);
    const instance = registry[vectorstore] as VectorStore;
    return instance.indexChunks(chunks, embeddings, params);
  };

  function deleteChunks(vectorstore: VectorStoreEnum, ids: string[]) {
    logger.debug('delete chunks, vectorstore:', vectorstore);
    const instance = registry[vectorstore] as VectorStore;
    return instance.deleteChunks(ids);
  };

  function deleteChunk(vectorstore: VectorStoreEnum, id: string) {
    logger.debug('delete chunk, vectorstore:', vectorstore);
    const instance = registry[vectorstore] as VectorStore;
    return instance.deleteChunk(id);
  };

  function search(vectorstore: VectorStoreEnum, indexName: string, query: string, attrs: any, params: SearchParams) {
    logger.debug('search for "%s" in index: %s, vectorstore:', query, indexName, vectorstore);
    const instance = registry[vectorstore] as VectorStore;
    return instance.search(indexName, query, attrs, params);
  };

  function getVectorStores() {
    return Object.entries(registry)
      .map(([key, p]) => ({
        key,
        name: p.__name,
      }));
  }

  return {
    getIndexes,
    getIndex,
    createIndex,
    dropIndex,
    getNumberChunks,
    dropData,
    indexChunks,
    deleteChunks,
    deleteChunk,
    getVectorStores,
    search,
  };

}
