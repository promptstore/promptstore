import { JSONSchema7 } from 'json-schema';

import logger from '../../logger';

import { LLMService } from '../models/llm_types';
import { Chunk } from './Chunk';
import {
  EmbeddingProvider,
} from './EmbeddingProvider';
import {
  VectorStore,
  VectorStoreService,
} from './VectorStore';

export interface IndexParams {
  indexId: string;
  newIndexName: string;
  index: any;
  schema: JSONSchema7;
  nodeLabel: string;
  embeddingNodeProperty: string;
  similarityMetric: string;
  embeddingProvider: string;
  vectorStoreProvider: string;
  workspaceId: number;
  username: string;
}

export class Indexer {

  protected indexesService: any;
  protected llmService: LLMService;
  protected vectorStoreService: VectorStoreService;

  constructor({ indexesService, llmService, vectorStoreService }) {
    this.indexesService = indexesService;
    this.llmService = llmService;
    this.vectorStoreService = vectorStoreService;
  }

  async index(chunks: Chunk[], params: Partial<IndexParams>) {
    const index = params.index || await this.createOrGetIndex(params);
    await this.indexChunks(chunks, {
      indexName: index.name,
      nodeLabel: params.nodeLabel,
      embeddingProvider: index.embeddingProvider,
      vectorStoreProvider: index.vectorStoreProvider,
    })
    return index;
  }

  async createOrGetIndex(params: Partial<IndexParams>) {
    const {
      indexId,
      newIndexName,
      schema,
      embeddingProvider,
      vectorStoreProvider,
      nodeLabel = 'Chunk',
      embeddingNodeProperty = 'embedding',
      similarityMetric = 'cosine',
      workspaceId,
      username,
    } = params;
    let index: any;
    if (indexId === 'new') {
      const embeddingProviders = this.llmService.getEmbeddingProviders().map(p => p.key);
      if (embeddingProvider && !embeddingProviders.includes(embeddingProvider)) {
        throw new Error('Unsupported embedding provider: ' + embeddingProvider);
      }

      const vectorStoreProviders = this.vectorStoreService.getVectorStores().map(p => p.key);
      if (vectorStoreProviders && !vectorStoreProviders.includes(vectorStoreProvider)) {
        throw new Error('Unsupported vector store provider: ' + vectorStoreProvider);
      }

      index = await this.createIndex({
        name: newIndexName,
        schema,
        workspaceId,
        username,
        embeddingProvider,
        vectorStoreProvider,
        nodeLabel,
        embeddingNodeProperty,
        similarityMetric,
      });

    } else {
      index = await this.indexesService.getIndex(indexId);
      if (!index) {
        throw new Error('Index not found: ' + indexId);
      }
    }

    return index;
  }

  async createIndex({
    name,
    schema,
    workspaceId,
    username,
    embeddingProvider,
    vectorStoreProvider,
    nodeLabel,
    embeddingNodeProperty,
    similarityMetric,
  }) {
    let embeddingDimension: number;
    if (embeddingProvider) {
      const embedder = EmbeddingProvider.create(embeddingProvider, this.llmService);
      const testEmbedding = await embedder.createEmbedding({ input: 'foo' });
      embeddingDimension = testEmbedding.embedding.length;
    }
    let index = await this.indexesService.getIndexByName(workspaceId, name);
    if (!index) {
      index = await this.indexesService.upsertIndex({
        name,
        schema,
        workspaceId,
        embeddingProvider,
        embeddingDimension,
        vectorStoreProvider,
        nodeLabel,
        embeddingNodeProperty,
        similarityMetric,
      }, username);
      logger.debug("Created new index '%s' [%s]", name, index.id);
    }
    const vectorStore = VectorStore.create(vectorStoreProvider, this.vectorStoreService);
    const existingPhysicalIndex = await vectorStore.getIndex(name, {
      nodeLabel,
      embeddingNodeProperty,
    });
    if (!existingPhysicalIndex) {
      await vectorStore.createIndex(name, schema, {
        embeddingDimension,
        nodeLabel,
        embeddingNodeProperty,
        similarityMetric,
      });
    }
    return index;
  }

  async indexChunks(chunks: Chunk[], {
    indexName,
    nodeLabel,
    embeddingProvider,
    vectorStoreProvider,
  }) {
    let embeddings: Array<number[]>;
    if (vectorStoreProvider !== 'redis') {
      const embedder = EmbeddingProvider.create(embeddingProvider, this.llmService);
      const proms = chunks.map((chunk: Chunk) => embedder.createEmbedding({ input: chunk.text }));
      const responses = await Promise.all(proms);
      embeddings = responses.map(r => r.embedding);
    }  // TODO - the Redis Vector Store calculates embeddings at the service end
    const vectorStore = VectorStore.create(vectorStoreProvider, this.vectorStoreService);
    await vectorStore.indexChunks(chunks, embeddings, {
      indexName,
      nodeLabel,
    });
  }

}
