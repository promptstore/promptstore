import { binPackTextsInOrder, formatTextAsProse, hashStr } from '../../utils';

import { EmbeddingRequest, EmbeddingResponse, EmbeddingUsage } from '../conversions/RosettaStone';
import { LLMModel, LLMService } from '../models/llm_types';

export abstract class EmbeddingProvider {

  __name: string;

  protected model: Partial<LLMModel>;
  protected llmService: LLMService;

  constructor(model: Partial<LLMModel>, llmService: LLMService) {
    this.model = model;
    this.llmService = llmService;
  }

  static create(model: LLMModel, llmService: LLMService) {
    return new class extends EmbeddingProvider {

      createEmbedding(request: EmbeddingRequest) {
        return this.llmService.createEmbedding(this.model.provider, request);
      }

      async createEmbeddings(texts: string[], maxTokens: number = 0) {
        const maxTokensPerRequest = this.model.contextWindow * 0.9;  // leave a little buffer
        const maxTokensPerChat = maxTokensPerRequest - maxTokens;

        const originalHashes = [];
        const dedupedTexts = [];
        for (const text of texts) {
          if (text && typeof text === 'string' && text.trim().length) {
            const hash = hashStr(text);
            // de-dup
            if (originalHashes.indexOf(hash) === -1) {
              dedupedTexts.push(text);
            }
            originalHashes.push(hash);
          } else {
            originalHashes.push(null);
          }
        }
        // logger.debug('originalHashes:', originalHashes);

        const bins: string[][] = binPackTextsInOrder(dedupedTexts, maxTokensPerChat, null, formatTextAsProse);
        // logger.debug('bins:', bins);

        const data = Array(originalHashes.length).fill(null);
        const proms = bins.map((text: string[]) => {
          const request = {
            input: text,
            model: model.model,
          };
          return this.createEmbedding(request);
        });
        const res = await Promise.all(proms);  // preserves order
        let i = 0;  // bin iteration
        const usageHashMap = {};  // avoid double counting duplicate text
        for (const response of res) {
          for (let j = 0; j < response.data.length; j++) {
            const hash = hashStr(bins[i][j]);
            let usage: EmbeddingUsage;
            if (usageHashMap[hash]) {
              usage = { prompt_tokens: 0, total_tokens: 0 };
            } else {
              usage = usageHashMap[hash] = response.usage;
            }
            let k = -1;
            while ((k = originalHashes.indexOf(hash, k + 1)) !== -1) {
              data[k] = {
                object: 'list',
                data: response.data[j],
                model: model.model,
                usage,
              };
            }
          }
          i += 1;
        }
        return data;
      }

    }(model, llmService);
  }

  abstract createEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse>

  abstract createEmbeddings(texts: string[], maxTokens: number): Promise<EmbeddingResponse[]>

}
