import type { Schema } from 'jsonschema';

import { Chunk } from './Chunk';
import { PluginMetadata } from './common_types';

export interface GetIndexParams {
  nodeLabel: string;
  embeddingNodeProperty: string;
}

export interface CreateIndexParams {
  nodeLabel: string;
  embeddingDimension: number;
  embeddingNodeProperty: string;
  similarityMetric: string;
}

export interface GetNumberChunksParams {
  nodeLabel: string;
}

export interface DropDataParams {
  nodeLabel: string;
}

export interface IndexChunksParams {
  indexName: string;
  nodeLabel: string;
  batchSize: number;
}

export interface DeleteChunksParams {
  indexName: string;
}

export interface SearchParams {
  queryEmbedding: number[];
  keywordIndexName: string;
  type: string;
  k: number;
}

export interface VectorStoreService {

  getIndexes(vectorstore: string): Promise<Array<any>>

  getIndex(vectorstore: string, indexName: string, params?: Partial<GetIndexParams>): Promise<any>

  createIndex(vectorstore: string, indexName: string, schema: Schema, params: Partial<CreateIndexParams>): Promise<any>

  dropIndex(vectorstore: string, indexName: string): void;

  getChunks(vectorstore: string, indexName: string, ids: string[]): Promise<Chunk>;

  getNumberChunks(vectorstore: string, indexName: string, params?: GetNumberChunksParams): Promise<number>;

  dropData(vectorstore: string, indexName: string, params?: DropDataParams): void;

  indexChunks(vectorstore: string, chunks: Chunk[], embeddings: Array<number[]>, params: Partial<IndexChunksParams>): Promise<string[]>

  deleteChunks(vectorstore: string, ids: string[], params?: DeleteChunksParams): void;

  deleteChunk(vectorstore: string, id: string, params?: DeleteChunksParams): void;

  search(vectorstore: string, indexName: string, query: string, attrs: any, logicalType: boolean, params: Partial<SearchParams>): Promise<any>

  getVectorStores(): PluginMetadata[];

}

export abstract class VectorStore {

  __name: string;

  protected vectorStoreService: VectorStoreService;

  constructor(vectorStoreService: VectorStoreService) {
    this.vectorStoreService = vectorStoreService;
  }

  static create(vectorstore: string, vectorStoreService: VectorStoreService) {
    return new class extends VectorStore {

      getIndexes() {
        return this.vectorStoreService.getIndexes(vectorstore);
      }

      getIndex(indexName: string, params?: Partial<GetIndexParams>) {
        return this.vectorStoreService.getIndex(vectorstore, indexName, params);
      }

      createIndex(indexName: string, schema: Schema, params: Partial<CreateIndexParams>) {
        return this.vectorStoreService.createIndex(vectorstore, indexName, schema, params);
      }

      dropIndex(indexName: string) {
        return this.vectorStoreService.dropIndex(vectorstore, indexName);
      }

      getChunks(indexName: string, ids: string[]) {
        return this.vectorStoreService.getChunks(vectorstore, indexName, ids);
      }

      getNumberChunks(indexName: string) {
        return this.vectorStoreService.getNumberChunks(vectorstore, indexName);
      }

      dropData(indexName: string) {
        return this.vectorStoreService.dropData(vectorstore, indexName);
      }

      indexChunks(chunks: Chunk[], embeddings: Array<number[]>, params: Partial<IndexChunksParams>) {
        return this.vectorStoreService.indexChunks(vectorstore, chunks, embeddings, params);
      }

      deleteChunks(ids: string[], params: DeleteChunksParams) {
        return this.vectorStoreService.deleteChunks(vectorstore, ids, params);
      }

      deleteChunk(id: string, params: DeleteChunksParams) {
        return this.vectorStoreService.deleteChunk(vectorstore, id, params);
      }

      search(indexName: string, query: string, attrs: any, logicalType: boolean, params: Partial<SearchParams>) {
        return this.vectorStoreService.search(vectorstore, indexName, query, attrs, logicalType, params);
      }

    }(vectorStoreService);
  }

  abstract getIndexes(): Promise<Array<any>>

  abstract getIndex(indexName: string, params?: Partial<GetIndexParams>): Promise<any>

  abstract createIndex(indexName: string, schema: Schema, params: Partial<CreateIndexParams>): Promise<any>

  abstract dropIndex(indexName: string): void;

  abstract getChunks(indexName: string, ids: string[]): Promise<Chunk>;

  abstract getNumberChunks(indexName: string, params?: GetNumberChunksParams): Promise<number>;

  abstract dropData(indexName: string, params?: DropDataParams): void;

  abstract indexChunks(chunks: Chunk[], embeddings: Array<number[]>, params: Partial<IndexChunksParams>): Promise<string[]>

  abstract deleteChunks(ids: string[], params?: DeleteChunksParams): void;

  abstract deleteChunk(id: string, params?: DeleteChunksParams): void;

  abstract search(indexName: string, query: string, attrs: any, logicalType: boolean, params: Partial<SearchParams>): Promise<any>

}
