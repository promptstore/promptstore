import { PluginMetadata } from './common_types';
import { EmbeddingRequest, EmbeddingResponse } from '../conversions/RosettaStone';

export interface EmbeddingService {

  createEmbedding(provider: string, request: EmbeddingRequest): Promise<EmbeddingResponse>

  getEmbeddingProviders?(): PluginMetadata[];

}

export abstract class EmbeddingProvider {

  __name: string;

  protected embeddingService: EmbeddingService;

  constructor(embeddingService: EmbeddingService) {
    this.embeddingService = embeddingService;
  }

  static create(provider: string, embeddingService: EmbeddingService) {
    return new class extends EmbeddingProvider {
      createEmbedding(request: EmbeddingRequest) {
        return this.embeddingService.createEmbedding(provider, request);
      }
    }(embeddingService);
  }

  abstract createEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse>

}
