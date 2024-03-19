export enum AnthropicStopReason {
  stop_sequence = 'stop_sequence',
  max_tokens = 'max_tokens',
}

interface AnthropicRequestMetadata {
  user_id?: string;  // An external identifier for the user who is associated with the request. This should be a uuid, hash value, or other opaque identifier. Anthropic may use this id to help detect abuse. Do not include any identifying information such as name, email address, or phone number.
}

export interface AnthropicChatCompletionRequest {
  model: string;  // The model that will complete your prompt.
  prompt: string;  // The prompt that you want Claude to complete.
  max_tokens_to_sample: number;  // The maximum number of tokens to generate before stopping. Note that our models may stop before reaching this maximum. This parameter only specifies the absolute maximum number of tokens to generate.
  stop_sequences?: string[];  // Sequences that will cause the model to stop generating completion text.
  temperature?: number;  // Amount of randomness injected into the response. Defaults to 1. Ranges from 0 to 1. Use temp closer to 0 for analytical / multiple choice, and closer to 1 for creative and generative tasks.
  top_p?: number;  // Use nucleus sampling. In nucleus sampling, we compute the cumulative distribution over all the options for each subsequent token in decreasing probability order and cut it off once it reaches a particular probability specified by top_p. You should either alter temperature or top_p, but not both.
  top_k?: number;  // Only sample from the top K options for each subsequent token. Used to remove "long tail" low probability responses.
  metadata?: AnthropicRequestMetadata;  // An object describing metadata about the request.
  stream?: boolean;  // Whether to incrementally stream the response using server-sent events.
}

export interface AnthropicChatCompletionResponse {
  completion: string;
  stop_reason: AnthropicStopReason;
  model: string;
}
