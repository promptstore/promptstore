import { JSONSchema7 } from 'json-schema';

import logger from '../../logger';
import { getExtension } from '../../utils';

import { Document } from './Document';
import { EmbeddingService } from './EmbeddingProvider';
import {
  CsvExtractor,
  ExtendedDocument,
  Extractor,
  ExtractorEnum,
  ExtractorParams,
  ExtractorService,
  JsonExtractor,
  Neo4jExtractor,
  OnesourceExtractor,
  TextExtractor,
  UnstructuredExtractor,
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
  WikipediaLoader,
  WikipediaLoaderParams,
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

  private embeddingService: EmbeddingService;
  private executionsService: any;
  private extractorService: ExtractorService;
  private indexesService: any;
  private graphStoreService: GraphStoreService;
  private loaderService: LoaderService;
  private vectorStoreService: VectorStoreService;

  private _embeddingProvider: string;
  private _vectorStoreProvider: VectorStoreEnum;
  private _graphStoreProvider: GraphStoreEnum;

  private _loader: Loader;
  private _extractors: Extractor[] = [];

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
    extractorProviders,
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

  public set loaderProvider(provider: LoaderEnum) {
    switch (provider) {
      case LoaderEnum.api:
        this._loader = new ApiLoader(this.loaderService);
        break;

      case LoaderEnum.minio:
        this._loader = new MinioLoader(this.loaderService);
        break;

      case LoaderEnum.wikipedia:
        this._loader = new WikipediaLoader(this.loaderService);
        break;

      default:
    }
  }

  public set extractorProviders(providers: ExtractorEnum[]) {
    for (const provider of providers) {
      switch (provider) {
        case ExtractorEnum.csv:
          this._extractors.push(new CsvExtractor(this.extractorService));
          break;

        case ExtractorEnum.json:
          this._extractors.push(new JsonExtractor(this.extractorService));
          break;

        case ExtractorEnum.neo4j:
          this._extractors.push(new Neo4jExtractor(this.extractorService));
          break;

        case ExtractorEnum.onesource:
          this._extractors.push(new OnesourceExtractor(this.extractorService));
          break;

        case ExtractorEnum.text:
          this._extractors.push(new TextExtractor(this.extractorService));
          break;

        case ExtractorEnum.unstructured:
          this._extractors.push(new UnstructuredExtractor(this.extractorService));
          break;

        default:
      }
    }
  }

  public set embeddingProvider(provider: string) {
    this._embeddingProvider = provider;
  }

  public set vectorStoreProvider(provider: VectorStoreEnum) {
    this._vectorStoreProvider = provider;
  }

  public set graphStoreProvider(provider: GraphStoreEnum) {
    this._graphStoreProvider = provider;
  }

}
