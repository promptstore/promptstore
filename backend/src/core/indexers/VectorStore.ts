import { JSONSchema7 } from 'json-schema';

import { Chunk } from './Chunk';
import { PluginMetadata } from './common_types';

export enum VectorStoreEnum {
  chroma = 'chroma',
  neo4j = 'neo4j',
  redis = 'redis',
}

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

  getIndexes(vectorstore: VectorStoreEnum): Promise<Array<any>>

  getIndex(vectorstore: VectorStoreEnum, indexName: string, params?: Partial<GetIndexParams>): Promise<any>

  createIndex(vectorstore: VectorStoreEnum, indexName: string, schema: JSONSchema7, params: Partial<CreateIndexParams>): Promise<any>

  dropIndex(vectorstore: VectorStoreEnum, indexName: string): void;

  getNumberChunks(vectorstore: VectorStoreEnum, indexName: string, params?: GetNumberChunksParams): Promise<number>;

  dropData(vectorstore: VectorStoreEnum, indexName: string, params?: DropDataParams): void;

  indexChunks(vectorstore: VectorStoreEnum, chunks: Chunk[], embeddings: Array<number[]>, params: Partial<IndexChunksParams>): Promise<string[]>

  deleteChunks(vectorstore: VectorStoreEnum, ids: string[], params?: DeleteChunksParams): void;

  deleteChunk(vectorstore: VectorStoreEnum, id: string, params?: DeleteChunksParams): void;

  search(vectorstore: VectorStoreEnum, indexName: string, query: string, attrs: any, params?: SearchParams): Promise<any>

  getVectorStores(): PluginMetadata[];

}

export abstract class VectorStore {

  __name: string;

  protected vectorStoreService: VectorStoreService;

  constructor(vectorStoreService: VectorStoreService) {
    this.vectorStoreService = vectorStoreService;
  }

  static create(vectorstore: VectorStoreEnum, vectorStoreService: VectorStoreService) {
    switch (vectorstore) {
      case VectorStoreEnum.chroma:
        return new ChromaVectorStore(vectorStoreService);

      case VectorStoreEnum.neo4j:
        return new Neo4jVectorStore(vectorStoreService);

      case VectorStoreEnum.redis:
        return new RedisVectorStore(vectorStoreService);

      default:
        return null;
    }
  }

  abstract getIndexes(): Promise<Array<any>>

  abstract getIndex(indexName: string, params?: Partial<GetIndexParams>): Promise<any>

  abstract createIndex(indexName: string, schema: JSONSchema7, params: Partial<CreateIndexParams>): Promise<any>

  abstract dropIndex(indexName: string): void;

  abstract getNumberChunks(indexName: string, params?: GetNumberChunksParams): Promise<number>;

  abstract dropData(indexName: string, params?: DropDataParams): void;

  abstract indexChunks(chunks: Chunk[], embeddings: Array<number[]>, params: Partial<IndexChunksParams>): Promise<string[]>

  abstract deleteChunks(ids: string[], params?: DeleteChunksParams): void;

  abstract deleteChunk(id: string, params?: DeleteChunksParams): void;

  abstract search(indexName: string, query: string, attrs: any, params?: SearchParams): Promise<any>

}

export class ChromaVectorStore extends VectorStore {

  getIndexes() {
    return this.vectorStoreService.getIndexes(VectorStoreEnum.chroma);
  }

  getIndex(indexName: string) {
    return this.vectorStoreService.getIndex(VectorStoreEnum.chroma, indexName);
  }

  createIndex(indexName: string, schema: JSONSchema7, params: Partial<CreateIndexParams>) {
    return this.vectorStoreService.createIndex(VectorStoreEnum.chroma, indexName, schema, params);
  }

  dropIndex(indexName: string) {
    return this.vectorStoreService.dropIndex(VectorStoreEnum.chroma, indexName);
  }

  getNumberChunks(indexName: string) {
    return this.vectorStoreService.getNumberChunks(VectorStoreEnum.chroma, indexName);
  }

  dropData(indexName: string) {
    return this.vectorStoreService.dropData(VectorStoreEnum.redis, indexName);
  }

  indexChunks(chunks: Chunk[], embeddings: Array<number[]>, params: Partial<IndexChunksParams>) {
    return this.vectorStoreService.indexChunks(VectorStoreEnum.chroma, chunks, embeddings, params);
  }

  deleteChunks(ids: string[], params: DeleteChunksParams) {
    return this.vectorStoreService.deleteChunks(VectorStoreEnum.chroma, ids, params);
  }

  deleteChunk(id: string, params: DeleteChunksParams) {
    return this.vectorStoreService.deleteChunk(VectorStoreEnum.chroma, id, params);
  }

  search(indexName: string, query: string, attrs: any) {
    return this.vectorStoreService.search(VectorStoreEnum.chroma, indexName, query, attrs);
  }

}

export class Neo4jVectorStore extends VectorStore {

  getIndexes() {
    return this.vectorStoreService.getIndexes(VectorStoreEnum.neo4j);
  }

  getIndex(indexName: string, params: Partial<GetIndexParams>) {
    return this.vectorStoreService.getIndex(VectorStoreEnum.neo4j, indexName, params);
  }

  createIndex(indexName: string, schema: JSONSchema7, params: Partial<CreateIndexParams>) {
    return this.vectorStoreService.createIndex(VectorStoreEnum.neo4j, indexName, schema, params);
  }

  dropIndex(indexName: string) {
    return this.vectorStoreService.dropIndex(VectorStoreEnum.neo4j, indexName);
  }

  getNumberChunks(indexName: string, params: GetNumberChunksParams) {
    return this.vectorStoreService.getNumberChunks(VectorStoreEnum.neo4j, indexName, params);
  }

  dropData(indexName: string, params: DropDataParams) {
    return this.vectorStoreService.dropData(VectorStoreEnum.neo4j, indexName, params);
  }

  indexChunks(chunks: Chunk[], embeddings: Array<number[]>, params: Partial<IndexChunksParams>) {
    return this.vectorStoreService.indexChunks(VectorStoreEnum.neo4j, chunks, embeddings, params);
  }

  deleteChunks(ids: string[]) {
    return this.vectorStoreService.deleteChunks(VectorStoreEnum.neo4j, ids);
  }

  deleteChunk(id: string) {
    return this.vectorStoreService.deleteChunk(VectorStoreEnum.neo4j, id);
  }

  search(indexName: string, query: string, attrs: any, params: SearchParams) {
    return this.vectorStoreService.search(VectorStoreEnum.neo4j, indexName, query, attrs, params);
  }

}

export class RedisVectorStore extends VectorStore {

  getIndexes() {
    return this.vectorStoreService.getIndexes(VectorStoreEnum.redis);
  }

  getIndex(indexName: string) {
    return this.vectorStoreService.getIndex(VectorStoreEnum.redis, indexName);
  }

  createIndex(indexName: string, schema: JSONSchema7, params: Partial<CreateIndexParams>) {
    return this.vectorStoreService.createIndex(VectorStoreEnum.redis, indexName, schema, params);
  }

  dropIndex(indexName: string) {
    return this.vectorStoreService.dropIndex(VectorStoreEnum.redis, indexName);
  }

  getNumberChunks(indexName: string) {
    return this.vectorStoreService.getNumberChunks(VectorStoreEnum.redis, indexName);
  }

  dropData(indexName: string) {
    return this.vectorStoreService.dropData(VectorStoreEnum.redis, indexName);
  }

  indexChunks(chunks: Chunk[], embeddings: Array<number[]>, params: Partial<IndexChunksParams>) {
    return this.vectorStoreService.indexChunks(VectorStoreEnum.redis, chunks, embeddings, params);
  }

  deleteChunks(ids: string[], params: DeleteChunksParams) {
    return this.vectorStoreService.deleteChunks(VectorStoreEnum.redis, ids, params);
  }

  deleteChunk(id: string, params: DeleteChunksParams) {
    return this.vectorStoreService.deleteChunk(VectorStoreEnum.redis, id, params);
  }

  search(indexName: string, query: string, attrs: any) {
    return this.vectorStoreService.search(VectorStoreEnum.redis, indexName, query, attrs);
  }

}
