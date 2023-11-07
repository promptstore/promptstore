import { JSONSchema7 } from 'json-schema';

import logger from '../../logger';

import { Chunk } from './Chunk';
import {
  EmbeddingProvider,
  EmbeddingProviderEnum,
  EmbeddingService,
} from './EmbeddingProvider';
import {
  VectorStore,
  VectorStoreEnum,
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
  embeddingProvider: EmbeddingProviderEnum;
  vectorStoreProvider: VectorStoreEnum;
  workspaceId: number;
  username: string;
}

export class Indexer {

  protected embeddingService: EmbeddingService;
  protected indexesService: any;
  protected vectorStoreService: VectorStoreService;

  constructor({ embeddingService, indexesService, vectorStoreService }) {
    this.embeddingService = embeddingService;
    this.indexesService = indexesService;
    this.vectorStoreService = vectorStoreService;
  }

  async index(chunks: Chunk[], params: Partial<IndexParams>) {
    const index = params.index || await this.createOrGetIndex(params);
    await this.indexChunks(chunks, {
      indexName: index.name,
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
      if (!Object.values(EmbeddingProviderEnum).includes(embeddingProvider)) {
        throw new Error('Unsupported embedding provider: ' + embeddingProvider);
      }

      if (!Object.values(VectorStoreEnum).includes(vectorStoreProvider)) {
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
      const embedder = EmbeddingProvider.create(embeddingProvider, this.embeddingService);
      const testEmbedding = await embedder.createEmbedding('foo');
      embeddingDimension = testEmbedding.length;
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
    embeddingProvider,
    vectorStoreProvider,
  }) {
    let embeddings: Array<number[]>;
    if (vectorStoreProvider === VectorStoreEnum.neo4j) {
      const embedder = EmbeddingProvider.create(embeddingProvider, this.embeddingService);
      const proms = chunks.map((chunk: Chunk) => embedder.createEmbedding(chunk.text));
      embeddings = await Promise.all(proms);
    }  // TODO - the Redis Vector Store calculates embeddings at the service end
    const vectorStore = VectorStore.create(vectorStoreProvider, this.vectorStoreService);
    await vectorStore.indexChunks(chunks, embeddings, {
      indexName,
    });
  }

}
