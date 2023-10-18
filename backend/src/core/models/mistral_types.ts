import { OpenAIMessage } from "./openai_types";

export interface MistrilChatCompletionRequest {
  model: string;
  messages: string | OpenAIMessage[];
  temperature?: number;  // default 0.7
  top_p?: number;  // default 1
  n?: number;  // default 1
  max_tokens?: number;  // default 8192
  stop?: string | string[];
  stream?: boolean;  // default false
  presence_penalty?: number;  // default 0
  frequency_penalty?: number;  // default 0
  logit_bias?: any;  // not currently supported (to be supported by vLLM engine)
  user?: string;
  best_of?: number;
  top_k: number;  // default -1
  ignore_eos?: false;  // default false
  use_beam_search: boolean;  // default false
}

// MistrilChatCompletionResponse compatible with OpenAI

export interface MistrilCompletionRequest {
  model: string;
  prompt: number[] | string | string[];
  suffix?: string;
  max_tokens?: number;  // default 16
  temperature?: number;  // default 1
  top_p?: number;  // default 1
  n?: number;  // default 1
  stream?: boolean;  // default false
  logprobs?: number;
  echo?: boolean;  // default false
  stop?: string | string[];
  presence_penalty?: number;  // default 0
  frequency_penalty?: number;  // default 0
  best_of?: number;
  logit_bias?: any;
  user?: string;
  top_k?: number;  // default -1
  ignore_eos?: boolean;  // default false
  use_beam_search?: boolean;  // default false
}

// MistrilCompletionResponse compatible with OpenAI