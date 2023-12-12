import { EmbeddingRequest, EmbeddingResponse } from '../conversions/RosettaStone';
import { LLMService } from '../models/llm_types';

export abstract class EmbeddingProvider {

  __name: string;

  protected llmService: LLMService;

  constructor(llmService: LLMService) {
    this.llmService = llmService;
  }

  static create(provider: string, llmService: LLMService) {
    return new class extends EmbeddingProvider {
      createEmbedding(request: EmbeddingRequest) {
        return this.llmService.createEmbedding(provider, request);
      }
    }(llmService);
  }

  abstract createEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse>

}
