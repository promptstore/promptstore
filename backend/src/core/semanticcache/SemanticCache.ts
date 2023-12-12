declare const Buffer;

import { SchemaFieldTypes, VectorAlgorithms } from 'redis';
import uuid from 'uuid';

import { LLMService } from '../models/llm_types';

const INDEX_NAME = 'idx:cache';
const PREFIX = 'vs:cache';
const SIMILARITY_DISTANCE_RANGE_THRESHOLD = 0.5;
const SIMILARITY_DISTANCE_SCORE_THRESHOLD = 0.1;

const float32Buffer = (arr: number[]) => {
  return Buffer.from(new Float32Array(arr).buffer);
};

export default class SemanticCache {

  llmService: LLMService;
  redisClient: any;
  logger: any;

  constructor(llmService: LLMService, redisClient: any, logger: any) {
    this.llmService = llmService;
    this.redisClient = redisClient;
    this.logger = logger;
    this.setup();
  }

  async setup() {
    this.logger.debug('Setting up Semantic Cache');
    try {
      const schema = {
        __uid: {
          type: SchemaFieldTypes.TAG,
        },
        prompt: {
          type: SchemaFieldTypes.TEXT,
        },
        content: {
          type: SchemaFieldTypes.TEXT,
        },
        prompt_vec: {
          type: SchemaFieldTypes.VECTOR,
          ALGORITHM: VectorAlgorithms.HNSW,
          TYPE: 'FLOAT32',
          DIM: 512,
          DISTANCE_METRIC: 'COSINE',
        },
      };
      await this.redisClient.ft.create(INDEX_NAME, schema, {
        ON: 'HASH',
        PREFIX,
      })
    } catch (err) {
      if (err.message === 'Index already exists') {
        this.logger.debug('Index already exists, skipped creation.');
      } else {
        this.logger.error('%s\n%s', err, err.stack);
        throw err;
      }
    }
  }

  async get(prompt: string, n: number = 1) {
    try {
      const { embedding } =
        await this.llmService.createEmbedding('sentenceencoder', { input: prompt });
      const query = '@prompt_vec:[VECTOR_RANGE $THRESHOLD $BLOB]=>{$EPSILON:0.5; $YIELD_DISTANCE_AS:dist}';
      const result = await this.redisClient.ft.search(INDEX_NAME, query, {
        PARAMS: {
          BLOB: float32Buffer(embedding),
          THRESHOLD: SIMILARITY_DISTANCE_RANGE_THRESHOLD,
        },
        SORTBY: {  // ascending because we want the closest item
          BY: 'dist',
        },
        LIMIT: {
          from: 0,
          size: n,
        },
        DIALECT: 2,
        RETURN: ['content', 'dist'],
      });
      const hits = result.documents.map((d: any) => d.value);
      // this.logger.debug('hits:', hits);
      return { embedding, hits };
    } catch (err) {
      this.logger.error('%s\n%s', err, err.stack);
      throw err;
    }
  }

  async set(prompt: string, content: string, embedding?: number[]) {
    try {
      if (!embedding) {
        const response = await this.llmService.createEmbedding('sentenceencoder', { input: prompt });
        embedding = response.embedding;
      }
      const uid = uuid.v4();
      const doc = {
        __uid: uid,
        prompt,
        content,
        prompt_vec: float32Buffer(embedding),
      };
      const key = `${PREFIX}:${uid}`;

      // this redis client is in legacy mode to support express caching,
      // which means it doesn't support setting a dictionary of values

      // this.logger.debug('adding document to index', INDEX_NAME, 'using key', key, ':', doc);
      // await this.redisClient.hSet(key, doc);
      const proms = [];
      for (const [k, v] of Object.entries(doc)) {
        proms.push(this.redisClient.hSet(key, k, v));
      }
      await Promise.all(proms);

    } catch (err) {
      this.logger.error('%s\n%s', err, err.stack);
      throw err;
    }
  }

}
