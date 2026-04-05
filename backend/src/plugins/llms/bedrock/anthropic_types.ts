export enum AnthropicStopReason {
  stop_sequence = 'stop_sequence',
  max_tokens = 'max_tokens',
}

interface AnthropicRequestMetadata {
  user_id?: string;  // An external identifier for the user who is associated with the request. This should be a uuid, hash value, or other opaque identifier. Anthropic may use this id to help detect abuse. Do not include any identifying information such as name, email address, or phone number.
}

// Content block for Messages API
export interface AnthropicContentBlock {
  type: 'text';
  text: string;
}

// Message structure for Messages API (Claude 3+)
export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

// Legacy Completions API Request (Claude 1, 2)
export interface AnthropicCompletionsRequest {
  model: string;
  prompt: string;
  max_tokens_to_sample: number;
  stop_sequences?: string[];
  temperature?: number;
  top_p?: number;
  top_k?: number;
  metadata?: AnthropicRequestMetadata;
  stream?: boolean;
}

// New Messages API Request (Claude 3+)
export interface AnthropicMessagesRequest {
  messages: AnthropicMessage[];
  max_tokens: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stop_sequences?: string[];
  anthropic_version: string;
  system?: string;
}

// Union type for request body
export type AnthropicRequestBody = AnthropicCompletionsRequest | AnthropicMessagesRequest;

// Legacy Completions API Response (Claude 1, 2)
export interface AnthropicCompletionsResponse {
  completion: string;
  stop_reason: AnthropicStopReason;
  model: string;
}

// New Messages API Response (Claude 3+)
export interface AnthropicMessagesResponse {
  content: AnthropicContentBlock[];
  stop_reason: AnthropicStopReason;
  model: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

// Union type for response
export type AnthropicChatCompletionResponse = AnthropicCompletionsResponse | AnthropicMessagesResponse;

// Legacy interface for backward compatibility
export interface AnthropicChatCompletionRequest {
  model: string;
  prompt: string;
  max_tokens_to_sample: number;
  stop_sequences?: string[];
  temperature?: number;
  top_p?: number;
  top_k?: number;
  metadata?: AnthropicRequestMetadata;
  stream?: boolean;
}
