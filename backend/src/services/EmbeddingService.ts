import { EmbeddingRequest } from '../core/conversions/RosettaStone';
import {
  EmbeddingProvider,
  EmbeddingService,
} from '../core/indexers/EmbeddingProvider';
import { PluginServiceParams } from '../core/indexers/Plugin';

export function EmbeddingService({ logger, registry }: PluginServiceParams): EmbeddingService {

  async function createEmbedding(provider: string, request: EmbeddingRequest) {
    logger.debug('create embedding, provider:', provider);
    const instance = registry[provider] as EmbeddingProvider;
    return instance.createEmbedding(request);
  };

  function getEmbeddingProviders() {
    return Object.entries(registry)
      .map(([key, p]) => {
        return {
          key,
          name: p.__name,
        };
      });
  }

  return {
    createEmbedding,
    getEmbeddingProviders,
  }

}
