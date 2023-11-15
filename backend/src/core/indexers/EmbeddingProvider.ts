import { PluginMetadata } from './common_types';

export enum EmbeddingProviderEnum {
  sentenceencoder = 'sentenceencoder',
}

export interface EmbeddingService {

  createEmbedding(provider: EmbeddingProviderEnum, content: string): Promise<number[]>

  getEmbeddingProviders?(): PluginMetadata[];

}

export abstract class EmbeddingProvider {

  __name: string;

  protected embeddingService: EmbeddingService;

  constructor(embeddingService: EmbeddingService) {
    this.embeddingService = embeddingService;
  }

  static create(provider: EmbeddingProviderEnum, embeddingService: EmbeddingService) {
    switch (provider) {
      case EmbeddingProviderEnum.sentenceencoder:
        return new SentenceEncoder(embeddingService);

      default:
        return null;
    }
  }

  abstract createEmbedding(content: string): Promise<number[]>

}

export class SentenceEncoder extends EmbeddingProvider {

  createEmbedding(content: string) {
    return this.embeddingService.createEmbedding(EmbeddingProviderEnum.sentenceencoder, content);
  }

}
