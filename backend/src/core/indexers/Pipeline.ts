import type { Schema } from 'jsonschema';

import logger from '../../logger';
import { getExtension } from '../../utils';

import { LLMModel, LLMService } from '../models/llm_types';
import { Document } from './Document';
import {
  ExtendedDocument,
  Extractor,
  CsvExtractorParams,
  JsonExtractorParams,
  Neo4jExtractorParams,
  OnesourceExtractorParams,
  TextExtractorParams,
  UnstructuredExtractorParams,
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
  ApiLoaderParams,
  Loader,
  LoaderService,
  MinioLoaderParams,
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
  & CsvExtractorParams
  & JsonExtractorParams
  & Neo4jExtractorParams
  & OnesourceExtractorParams
  & TextExtractorParams
  & UnstructuredExtractorParams
  & IndexParams
  & GraphStoreIndexParams
  & AddChunksParams
  & DocumentsParams;

export class Pipeline {

  private executionsService: any;
  private extractorService: ExtractorService;
  private functionsService: any;
  private graphStoreService: GraphStoreService;
  private indexesService: any;
  private llmService: LLMService;
  private loaderService: LoaderService;
  private vectorStoreService: VectorStoreService;

  private _embeddingModel: Partial<LLMModel>;
  private _vectorStoreProvider: string;
  private _graphStoreProvider: string;

  private _loader: Loader;
  private _extractors: Extractor[] = [];

  constructor({
    executionsService,
    extractorService,
    functionsService,
    graphStoreService,
    indexesService,
    llmService,
    loaderService,
    vectorStoreService,
  }, {
    loaderProvider,
    extractorProviders,
    embeddingModel,
    vectorStoreProvider,
    graphStoreProvider,
  }) {
    this.executionsService = executionsService;
    this.extractorService = extractorService;
    this.functionsService = functionsService;
    this.graphStoreService = graphStoreService;
    this.indexesService = indexesService;
    this.llmService = llmService;
    this.loaderService = loaderService;
    this.vectorStoreService = vectorStoreService;

    // uses the setters
    this.loaderProvider = loaderProvider;
    this.extractorProviders = extractorProviders;
    this.embeddingModel = embeddingModel;
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
      if (params.indexId === 'new' || !params.indexId) {
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
      if (!this._embeddingModel && this._vectorStoreProvider !== 'redis' && this._vectorStoreProvider !== 'elasticsearch') {
        if (params.indexId === 'new' || !params.indexId) {
          this.embeddingModel = params.embeddingModel;
        } else {
          if (!index) {
            index = await this.getExistingIndex(params.indexId);
          }
          this.embeddingModel = {
            provider: index.embeddingProvider,
            model: index.embeddingModel,
          };
        }
      }
      if (!this._embeddingModel && this._vectorStoreProvider !== 'redis' && this._vectorStoreProvider !== 'elasticsearch') {
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
    const { workspaceId, username } = params;

    // Extract
    const rawChunks = await extractor.getChunks(documents, params);
    // logger.debug('raw chunks:', rawChunks);

    let chunks = [];
    if (params.rephraseFunctionIds?.length) {
      const texts = rawChunks.map(c => c.text);
      const outputFormatter = {
        name: 'output_formatter',
        description: 'Output as JSON. Should always be used to format your response to the user.',
        parameters: {
          type: 'object',
          properties: {
            results: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: {
                    type: 'integer',
                    desciption: 'unique index of result',
                  },
                  rephrased_result: {
                    description: 'rephrased content',
                    type: 'string',
                  },
                }
              }
            }
          },
          required: ['results'],
        },
      };
      const functions = [outputFormatter];
      const extraSystemPrompt = `Process each of the provided text items and return the results as a JSON list of objects using the output_formatter.`;
      const args = { content: texts };
      // logger.debug('args:', args);
      for (const functionId of params.rephraseFunctionIds) {
        const func = await this.functionsService.getFunction(functionId);
        const { errors, response } = await this.executionsService.executeFunction({
          workspaceId,
          username,
          batch: true,
          func,
          args,
          extraSystemPrompt,

          // TODO
          params: { maxTokens: 4096 },

          functions,
          options: {
            batchResultKey: 'rephrased_result',
            contentProp: 'content',
            maxTokensRelativeToContextWindow: 0.5,
          },
        });
        if (errors) {
          logger.error('Error calling function "%s":', func.name, errors);
          return { errors };
        }
        const serializedJson = response.choices[0].message.function_call.arguments;
        const json = JSON.parse(serializedJson);
        logger.debug('json:', json);
        let i = 0;
        for (const chunk of rawChunks) {
          chunks.push({
            ...chunk,
            text: json[i],
          });
          i += 1;
        }
      }
    } else {
      chunks = rawChunks;
    }
    // logger.debug('chunks:', chunks);

    logger.debug('Indexing %d chunks', chunks.length);

    // Index to Vector Store or Graph Store

    // `schema` required only for new index
    let schema: Schema;
    if (!params.index && (params.indexId === 'new' || !params.indexId)) {
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
          embeddingModel: this._embeddingModel,
          vectorStoreProvider: this._vectorStoreProvider,
        });
      } else {
        await indexer.indexChunks(chunks, {
          indexName: index.name,
          maxTokens: params.maxTokens,
          nodeLabel: params.nodeLabel,
          embeddingModel: this._embeddingModel,
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

  public set embeddingModel(model: Partial<LLMModel>) {
    this._embeddingModel = model;
  }

  public set vectorStoreProvider(provider: string) {
    this._vectorStoreProvider = provider;
  }

  public set graphStoreProvider(provider: string) {
    this._graphStoreProvider = provider;
  }

}
