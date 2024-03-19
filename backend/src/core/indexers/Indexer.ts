import type { Schema } from 'jsonschema';

import logger from '../../logger';

import { LLMModel, LLMService } from '../models/llm_types';
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
  schema: Schema;
  maxTokens: number;
  nodeLabel: string;
  embeddingNodeProperty: string;
  similarityMetric: string;
  embeddingModel: Partial<LLMModel>;
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
    let index = params.index || await this.createOrGetIndex(params);

    // TODO - requires recreating the physical index,
    // which requires redetermining the embedding dimension
    // Should an existing index be mutable?
    // Maybe the embedding model should be a property of the Vector Store
    // Node, not a separate node.
    // if (params.embeddingModel.model !== index.embeddingModel) {
    //   logger.debug('updating index');
    //   const { model, provider } = params.embeddingModel;
    //   index = await this.indexesService.upsertIndex({
    //     ...index,
    //     embeddingProvider: provider,
    //     embeddingModel: model,
    //   }, params.username);
    // }

    await this.indexChunks(chunks, {
      indexName: index.name,
      maxTokens: params.maxTokens,
      nodeLabel: params.nodeLabel,
      embeddingModel: {
        provider: index.embeddingProvider,
        model: index.embeddingModel,
      },
      vectorStoreProvider: index.vectorStoreProvider,
    })
    return index;
  }

  async createOrGetIndex(params: Partial<IndexParams>) {
    const {
      indexId,
      newIndexName,
      schema,
      embeddingModel,
      vectorStoreProvider,
      nodeLabel = 'Chunk',
      embeddingNodeProperty = 'embedding',
      similarityMetric = 'cosine',
      workspaceId,
      username,
    } = params;
    let index: any;
    if (indexId === 'new' || !indexId) {
      const embeddingProviders = this.llmService.getEmbeddingProviders().map(p => p.key);
      // logger.debug('embedding providers:', embeddingProviders);
      // logger.debug('embedding model:', embeddingModel);
      if (embeddingModel && !embeddingProviders.includes(embeddingModel.provider)) {
        throw new Error('Unsupported embedding provider: ' + embeddingModel.provider);
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
        embeddingModel,
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
    embeddingModel,
    vectorStoreProvider,
    nodeLabel,
    embeddingNodeProperty,
    similarityMetric,
  }) {
    let embeddingDimension: number;
    if (embeddingModel) {
      const embedder = EmbeddingProvider.create(embeddingModel, this.llmService);
      const response = await embedder.createEmbedding({ input: 'foo', model: embeddingModel.model });
      embeddingDimension = response.data[0].embedding.length;
    }
    let index = await this.indexesService.getIndexByName(workspaceId, name);
    if (!index) {
      index = await this.indexesService.upsertIndex({
        name,
        schema,
        workspaceId,
        embeddingProvider: embeddingModel?.provider,
        embeddingModel: embeddingModel?.model,
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
    maxTokens,
    nodeLabel,
    embeddingModel,
    vectorStoreProvider,
  }) {
    let embeddings: Array<number[]>;
    if (vectorStoreProvider !== 'redis' && vectorStoreProvider !== 'elasticsearch') {
      const embedder = EmbeddingProvider.create(embeddingModel, this.llmService);
      const texts = chunks.map(c => c.text);
      const res = await embedder.createEmbeddings(texts, maxTokens);
      embeddings = res.data.map(e => e.embedding);
    }  // TODO - the Redis Vector Store calculates embeddings at the service end
    const vectorStore = VectorStore.create(vectorStoreProvider, this.vectorStoreService);
    await vectorStore.indexChunks(chunks, embeddings, {
      indexName,
      nodeLabel,
    });
  }

}
