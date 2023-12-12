import { JSONSchema7 } from 'json-schema';

import logger from '../../logger';
import { getExtension } from '../../utils';

import { LLMService } from '../models/llm_types';
import { Document } from './Document';
import {
  ExtendedDocument,
  Extractor,
  ExtractorParams,
  ExtractorService,
} from './Extractor';
import {
  AddChunksParams,
  GraphStore,
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
  LoaderService,
  MinioLoader,
  MinioLoaderParams,
  WikipediaLoader,
  WikipediaLoaderParams,
} from './Loader';
import {
  VectorStoreService,
} from './VectorStore';

interface GraphStoreIndexParams {
  name: string,
  workspaceId: number;
  graphStoreProvider: string;
  nodeLabel: string
  embeddingNodeProperty: string;
  textNodeProperties: string[];
}

interface DocumentsParams {
  documents: Document[];
}

type RunParams = ApiLoaderParams
  & MinioLoaderParams
  & WikipediaLoaderParams
  & ExtractorParams
  & IndexParams
  & GraphStoreIndexParams
  & AddChunksParams
  & DocumentsParams;

export class Pipeline {

  private executionsService: any;
  private extractorService: ExtractorService;
  private indexesService: any;
  private graphStoreService: GraphStoreService;
  private llmService: LLMService;
  private loaderService: LoaderService;
  private vectorStoreService: VectorStoreService;

  private _embeddingProvider: string;
  private _vectorStoreProvider: string;
  private _graphStoreProvider: string;

  private _loader: Loader;
  private _extractors: Extractor[] = [];

  constructor({
    executionsService,
    extractorService,
    indexesService,
    graphStoreService,
    llmService,
    loaderService,
    vectorStoreService,
  }, {
    loaderProvider,
    extractorProviders,
    embeddingProvider,
    vectorStoreProvider,
    graphStoreProvider,
  }) {
    this.executionsService = executionsService;
    this.extractorService = extractorService;
    this.indexesService = indexesService;
    this.graphStoreService = graphStoreService;
    this.llmService = llmService;
    this.loaderService = loaderService;
    this.vectorStoreService = vectorStoreService;
    this.loaderProvider = loaderProvider;
    this.extractorProviders = extractorProviders;
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
    logger.debug('Run pipeline with params:', params);

    // Check preconditions
    if (!this._extractors.length) {
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
    if (!this._graphStoreProvider) {
      if (!this._embeddingProvider && this._vectorStoreProvider !== 'redis' {
        if (params.indexId === 'new') {
          this.embeddingProvider = params.embeddingProvider;
        } else {
          if (!index) {
            index = await this.getExistingIndex(params.indexId);
          }
          this.embeddingProvider = index.embeddingProvider;
        }
      }
      if (!this._embeddingProvider && this._vectorStoreProvider !== 'redis') {
        throw new Error('Missing embedding provider');
      }
    }

    let docs: Document[] = params.documents;
    let documents: ExtendedDocument[];

    // Load
    if (docs?.length || this._loader) {
      if (this._loader && !docs?.length) {
        docs = await this._loader.load(params);
      }
      documents = docs.map(doc => ({
        ...doc,
        ext: getExtension(doc.objectName),
      }));
    }
    logger.debug('documents:', documents);

    if (this._extractors.length === 1) {
      index = await this.extractAndIndex(documents, params, this._extractors[0], index);
      return [index];
    }

    const extractorMap: Record<number, Document[]> = {};
    for (const doc of documents) {
      const index = this._extractors.findIndex(x => x.matchDocument(doc));
      if (index !== -1) {
        if (!extractorMap[index]) {
          extractorMap[index] = [];
        }
        extractorMap[index].push(doc);
      }
    }
    const proms = Object.entries(extractorMap).map(([index, documents], i) =>
      this.extractAndIndex(documents, params, this._extractors[index], null, String(i))
    );
    return await Promise.all(proms);
  }

  async extractAndIndex(documents: Document[], params: RunParams, extractor: Extractor, index?: any, suffix?: string) {
    // Extract
    const chunks = await extractor.getChunks(documents, params);
    // logger.debug('chunks:', chunks);

    logger.debug('Indexing %d chunks', chunks.length);

    // Index to Vector Store or Graph Store

    // `schema` required only for new index
    let schema: JSONSchema7;
    if (!params.index && params.indexId === 'new') {
      schema = await extractor.getSchema(params);
    }

    if (this._vectorStoreProvider) {
      const indexer = new Indexer({
        indexesService: this.indexesService,
        llmService: this.llmService,
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
          nodeLabel: params.nodeLabel,
          embeddingProvider: this._embeddingProvider,
          vectorStoreProvider: this._vectorStoreProvider,
        });
      }

    } else if (this._graphStoreProvider) {
      if (!index) {
        if (params.indexId === 'new') {
          const {
            workspaceId,
            textNodeProperties,
            username,
          } = params;
          let newIndexName = params.newIndexName;
          if (suffix) {
            newIndexName += '-' + suffix;
          }
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
      const graphStore = GraphStore.create(this._graphStoreProvider, index.name, {
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

  public set loaderProvider(loader: string) {
    this._loader = Loader.create(loader, this.loaderService);
  }

  public set extractorProviders(providers: string[]) {
    for (const provider of providers) {
      this._extractors.push(Extractor.create(provider, this.extractorService));
    }
  }

  public set embeddingProvider(provider: string) {
    this._embeddingProvider = provider;
  }

  public set vectorStoreProvider(provider: string) {
    this._vectorStoreProvider = provider;
  }

  public set graphStoreProvider(provider: string) {
    this._graphStoreProvider = provider;
  }

}
