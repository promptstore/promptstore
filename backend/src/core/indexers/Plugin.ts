import { Logger } from 'winston';

import { EmbeddingProvider } from './EmbeddingProvider';
import { Extractor } from './Extractor';
import { GraphStore } from './GraphStore';
import { Loader } from './Loader';
import { VectorStore } from './VectorStore';

type Plugin = EmbeddingProvider | Extractor | GraphStore | Loader | VectorStore;

export type Registry = Record<string, Plugin>;

export interface PluginServiceParams {
  logger: Logger;
  registry: Registry;
}
