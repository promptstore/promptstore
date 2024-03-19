import { Logger } from 'winston';

import { LLM } from '../models/llm_types';
import { Parser } from '../outputprocessing/OutputProcessingPipeline_types';
import { EmbeddingProvider } from './EmbeddingProvider';
import { Extractor } from './Extractor';
import { GraphStore } from './GraphStore';
import { Loader } from './Loader';
import { VectorStore } from './VectorStore';

export type Plugin = EmbeddingProvider | Extractor | GraphStore | LLM | Loader | Parser | VectorStore;

export type Registry = Record<string, Plugin>;

export interface PluginServiceParams {
  logger: Logger;
  registry: Registry;
  services: any;
}
