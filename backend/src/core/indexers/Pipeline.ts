import { JSONSchema7 } from 'json-schema';

import logger from '../../logger';

import { Chunk } from './Chunk';
import { Document } from './Document';
import { EmbeddingProviderEnum, EmbeddingService } from './EmbeddingProvider';
import {
  Extractor,
  ExtractorEnum,
  ExtractorParams,
  ExtractorService,
  JsonExtractor,
} from './Extractor';
import {
  AddChunksParams,
  GraphStore,
  GraphStoreEnum,
  GraphStoreService,
} from './GraphStore';
import {
  IndexParams,
  Indexer,
} from './Indexer';
import {
  ApiLoader,
  ApiLoaderParams,
  Loader,
  LoaderEnum,
  LoaderService,
  MinioLoader,
  MinioLoaderParams,
} from './Loader';
import {
  VectorStoreEnum,
  VectorStoreService,
} from './VectorStore';

interface GraphStoreIndexParams {
  name: string,
  workspaceId: number;
  graphStoreProvider: GraphStoreEnum;
  nodeLabel: string
  embeddingNodeProperty: string;
  textNodeProperties: string[];
}

type RunParams = ApiLoaderParams
  & MinioLoaderParams
  & ExtractorParams
  & IndexParams
  & GraphStoreIndexParams
  & AddChunksParams;

export class Pipeline {

  private embeddingService: EmbeddingService;
  private executionsService: any;
  private extractorService: ExtractorService;
  private indexesService: any;
  private graphStoreService: GraphStoreService;
  private loaderService: LoaderService;
  private vectorStoreService: VectorStoreService;

  private _embeddingProvider: EmbeddingProviderEnum;
  private _vectorStoreProvider: VectorStoreEnum;
  private _graphStoreProvider: GraphStoreEnum;

  private _loader: Loader;
  private _extractor: Extractor;

  constructor({
    embeddingService,
    executionsService,
    extractorService,
    indexesService,
    graphStoreService,
    loaderService,
    vectorStoreService,
  }, {
    loaderProvider,
    extractorProvider,
    embeddingProvider,
    vectorStoreProvider,
    graphStoreProvider,
  }) {
    this.embeddingService = embeddingService;
    this.executionsService = executionsService;
    this.extractorService = extractorService;
    this.indexesService = indexesService;
    this.graphStoreService = graphStoreService;
    this.loaderService = loaderService;
    this.vectorStoreService = vectorStoreService;
    this.loader = loaderProvider;
    this.extractor = extractorProvider;
    this.embeddingProvider = embeddingProvider;
    this.vectorStoreProvider = vectorStoreProvider;
    this.graphStoreProvider = graphStoreProvider;
  }

  /**
   * [ Load ] --> [ Extract ] --> [ Index ] | [ Graph Store ]
   * 
   * @param params RunParams
   * @returns 
   */
  async run(params: RunParams) {
    // Check preconditions
    if (!this._extractor) {
      throw new Error('Missing extractor');
    }

    // Check Store
    let index = params.index;
    if (!this._vectorStoreProvider && !this._graphStoreProvider) {
      // determine from params
      if (params.indexId === 'new') {
        this.vectorStoreProvider = params.vectorStoreProvider;
        this.graphStoreProvider = params.graphStoreProvider;
      } else {
        if (!index) {
          index = await this.getExistingIndex(params.indexId);
        }
        this.vectorStoreProvider = index.vectorStoreProvider;
        this.graphStoreProvider = index.graphStoreProvider;
      }
    }
    if (!this._vectorStoreProvider && !this._graphStoreProvider) {
      throw new Error('Missing store');
    }

    // Check Embedding Provider
    if (!this._embeddingProvider && this._vectorStoreProvider !== VectorStoreEnum.redis) {
      if (params.indexId === 'new') {
        this.embeddingProvider = params.embeddingProvider;
      } else {
        if (!index) {
          index = await this.getExistingIndex(params.indexId);
        }
        this.embeddingProvider = index.embeddingProvider;
      }
    }
    if (!this._embeddingProvider && this._vectorStoreProvider !== VectorStoreEnum.redis) {
      throw new Error('Missing embedding provider');
    }

    let documents: Document[];
    let chunks: Chunk[];

    // Load
    if (this._loader) {
      documents = await this._loader.load(params);
    }

    // Extract
    chunks = await this._extractor.getChunks(documents, params);

    logger.debug('Indexing %d chunks', chunks.length);

    // Index to Vector Store or Graph Store

    // `schema` required only for new index
    let schema: JSONSchema7;
    if (!params.index && params.indexId === 'new') {
      schema = await this._extractor.getSchema(params);
    }

    if (this._vectorStoreProvider) {
      const indexer = new Indexer({
        embeddingService: this.embeddingService,
        indexesService: this.indexesService,
        vectorStoreService: this.vectorStoreService,
      });
      if (!index) {
        index = await indexer.index(chunks, {
          ...params,
          schema,
          embeddingProvider: this._embeddingProvider,
          vectorStoreProvider: this._vectorStoreProvider,
        });
      } else {
        await indexer.indexChunks(chunks, {
          indexName: index.name,
          embeddingProvider: this._embeddingProvider,
          vectorStoreProvider: this._vectorStoreProvider,
        });
      }

    } else if (this._graphStoreProvider) {
      if (!index) {
        if (params.indexId === 'new') {
          const {
            newIndexName,
            workspaceId,
            textNodeProperties,
            username,
          } = params;
          index = await this.indexesService.upsertIndex({
            name: newIndexName,
            schema,
            workspaceId,
            graphStoreProvider: this._graphStoreProvider,
            textNodeProperties,
          }, username);
          logger.debug("Created new graph index '%s' [%s]", newIndexName, index.id);
        } else {
          index = await this.getExistingIndex(params.indexId);
        }
      }
      const graphStore = GraphStore.create(this._graphStoreProvider, {
        executionsService: this.executionsService,
        graphStoreService: this.graphStoreService,
      });
      graphStore.addChunks(chunks, params);
    }
    return index;
  }

  async getExistingIndex(indexId: string) {
    const index = await this.indexesService.getIndex(indexId);
    if (!index) {
      throw new Error('Index not found: ' + indexId);
    }
    return index;
  }

  public set loader(provider: LoaderEnum) {
    switch (provider) {
      case LoaderEnum.api:
        this._loader = new ApiLoader(this.loaderService);
        break;

      case LoaderEnum.minio:
        this._loader = new MinioLoader(this.loaderService);

      default:
    }
  }

  public set extractor(provider: ExtractorEnum) {
    switch (provider) {
      case ExtractorEnum.json:
        this._extractor = new JsonExtractor(this.extractorService);

      default:
    }
  }

  public set embeddingProvider(provider: EmbeddingProviderEnum) {
    this._embeddingProvider = provider;
  }

  public set vectorStoreProvider(provider: VectorStoreEnum) {
    this._vectorStoreProvider = provider;
  }

  public set graphStoreProvider(provider: GraphStoreEnum) {
    this._graphStoreProvider = provider;
  }

}
