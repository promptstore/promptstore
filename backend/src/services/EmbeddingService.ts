import {
  EmbeddingProvider,
  EmbeddingProviderEnum,
  EmbeddingService,
} from '../core/indexers/EmbeddingProvider';
import { PluginServiceParams } from '../core/indexers/Plugin';

export function EmbeddingService({ logger, registry }: PluginServiceParams): EmbeddingService {

  async function createEmbedding(provider: EmbeddingProviderEnum, content: string) {
    logger.debug('create embedding, provider:', provider);
    const instance = registry[provider] as EmbeddingProvider;
    return instance.createEmbedding(content);
  };

  function getEmbeddingProviders() {
    return Object.entries(registry)
      .map(([key, p]) => ({
        key,
        name: p.__name,
      }));
  }

  return {
    createEmbedding,
    getEmbeddingProviders,
  }

}
