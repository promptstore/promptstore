import { OpenAIMessage } from "./openai_types";

export interface MistralChatCompletionRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;  // default 0.7
  top_p?: number;  // default 1
  max_tokens?: number;  // default 8192
  stream?: boolean;  // default false
  safe_mode?: boolean;  // Whether to inject a safety prompt before all conversations. Default: false
  random_seed?: number;  // The seed to use for random sampling. If set, different calls will generate deterministic results.

  // not in latest api - maybe open source version only
  // n?: number;  // default 1
  // stop?: string | string[];
  // presence_penalty?: number;  // default 0
  // frequency_penalty?: number;  // default 0
  // logit_bias?: any;  // not currently supported (to be supported by vLLM engine)
  // user?: string;
  // best_of?: number;
  // top_k: number;  // default -1
  // ignore_eos?: false;  // default false
  // use_beam_search: boolean;  // default false
}

// MistralChatCompletionResponse compatible with OpenAI

// not in latest api - maybe open source version only
// export interface MistralCompletionRequest {
//   model: string;
//   prompt: number[] | string | string[];
//   suffix?: string;
//   max_tokens?: number;  // default 16
//   temperature?: number;  // default 1
//   top_p?: number;  // default 1
//   n?: number;  // default 1
//   stream?: boolean;  // default false
//   logprobs?: number;
//   echo?: boolean;  // default false
//   stop?: string | string[];
//   presence_penalty?: number;  // default 0
//   frequency_penalty?: number;  // default 0
//   best_of?: number;
//   logit_bias?: any;
//   user?: string;
//   top_k?: number;  // default -1
//   ignore_eos?: boolean;  // default false
//   use_beam_search?: boolean;  // default false
// }

// MistralCompletionResponse compatible with OpenAI

export interface MistralEmbeddingRequest {
  model: string;
  input: string[];
  envoding_format: string;  // The format of the output data. Value: "float"
}
