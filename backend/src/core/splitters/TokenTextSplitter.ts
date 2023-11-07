import type * as tiktoken from 'js-tiktoken';
import { Tiktoken, TiktokenBPE } from 'js-tiktoken/lite';

import { AsyncCaller } from './AsyncCaller';
import { TextSplitter, TextSplitterParams } from './TextSplitter';

export interface TokenTextSplitterParams extends TextSplitterParams {
  encodingName: tiktoken.TiktokenEncoding;
  allowedSpecial: 'all' | Array<string>;
  disallowedSpecial: 'all' | Array<string>;
}

export class TokenTextSplitter extends TextSplitter implements TokenTextSplitterParams {

  encodingName: tiktoken.TiktokenEncoding;
  allowedSpecial: 'all' | Array<string>;
  disallowedSpecial: 'all' | Array<string>;

  private tokenizer: tiktoken.Tiktoken;

  constructor(params?: Partial<TokenTextSplitterParams>) {
    super(params);
    this.encodingName = params?.encodingName ?? 'gpt2';
    this.allowedSpecial = params?.allowedSpecial ?? [];
    this.disallowedSpecial = params?.disallowedSpecial ?? 'all';
  }

  async splitText(text: string): Promise<string[]> {
    if (!this.tokenizer) {
      this.tokenizer = await getEncoding(this.encodingName);
    }
    const splits: string[] = [];
    const input_ids = this.tokenizer.encode(
      text,
      this.allowedSpecial,
      this.disallowedSpecial
    );

    let start_idx = 0;
    let cur_idx = Math.min(start_idx + this.chunkSize, input_ids.length);
    let chunk_ids = input_ids.slice(start_idx, cur_idx);

    while (start_idx < input_ids.length) {
      splits.push(this.tokenizer.decode(chunk_ids));

      start_idx += this.chunkSize - this.chunkOverlap;
      cur_idx = Math.min(start_idx + this.chunkSize, input_ids.length);
      chunk_ids = input_ids.slice(start_idx, cur_idx);
    }

    return splits;
  }

}

const cache: Record<string, Promise<TiktokenBPE>> = {};

const caller = /* #__PURE__ */ new AsyncCaller({});

async function getEncoding(
  encoding: tiktoken.TiktokenEncoding,
  options?: {
    signal?: AbortSignal;
    extendedSpecialTokens?: Record<string, number>;
  }
) {
  if (!(encoding in cache)) {
    cache[encoding] = caller
      .fetch(`https://tiktoken.pages.dev/js/${encoding}.json`, {
        signal: options?.signal,
      })
      .then((res) => res.json())
      .catch((e) => {
        delete cache[encoding];
        throw e;
      });
  }

  return new Tiktoken(await cache[encoding], options?.extendedSpecialTokens);
}
