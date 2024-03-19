interface AnthropicRequestMetadata {
  user_id?: string;  // An external identifier for the user who is associated with the request. This should be a uuid, hash value, or other opaque identifier. Anthropic may use this id to help detect abuse. Do not include any identifying information such as name, email address, or phone number.
}

interface AnthropicV1TextContent {
  type: string;
  text: string;
}

interface AnthropicV1ImageSource {
  type: string;
  media_type: string;
  data: string;
}

interface AnthropicV1ImageContent {
  type: string;
  source: AnthropicV1ImageSource;
}

export type AnthropicV1ContentObject = AnthropicV1TextContent | AnthropicV1ImageContent;

type ContentType = string | AnthropicV1ContentObject[];

export interface AnthropicV1Message<T = ContentType> {
  role: string;  // Our models are trained to operate on alternating user and assistant conversational turns.
  content: T;  // Input messages. We currently support the base64 source type for images, and the image/jpeg, image/png, image/gif, and image/webp media types.
}

export interface AnthropicV1ChatCompletionRequest {
  model: string;  // The model that will complete your prompt.
  messages: AnthropicV1Message[];
  system?: string;  // System prompt. A system prompt is a way of providing context and instructions to Claude, such as specifying a particular goal or role.
  max_tokens: number;
  stop_sequences?: string[];  // Sequences that will cause the model to stop generating completion text.
  temperature?: number;  // Amount of randomness injected into the response. Defaults to 1. Ranges from 0 to 1. Use temp closer to 0 for analytical / multiple choice, and closer to 1 for creative and generative tasks.
  top_p?: number;  // Use nucleus sampling. In nucleus sampling, we compute the cumulative distribution over all the options for each subsequent token in decreasing probability order and cut it off once it reaches a particular probability specified by top_p. You should either alter temperature or top_p, but not both.
  top_k?: number;  // Only sample from the top K options for each subsequent token. Used to remove "long tail" low probability responses.
  metadata?: AnthropicRequestMetadata;  // An object describing metadata about the request.
  stream?: boolean;  // Whether to incrementally stream the response using server-sent events.
}

interface AnthropicV1Usage {
  input_tokens: number;
  output_tokens: number;
}

export interface AnthropicV1ChatCompletionResponse {
  id: string;
  type: string;  // For Messages, this is always "message".
  role: string;  // This will always be "assistant".
  content: AnthropicV1TextContent[];
  model: string;
  stop_reason: string;  // This may be one the following values: "end_turn": the model reached a natural stopping point, "max_tokens": we exceeded the requested max_tokens or the model's maximum, "stop_sequence": one of your provided custom stop_sequences was generated
  stop_sequence: string;  // Which custom stop sequence was generated, if any.
  usage: AnthropicV1Usage;
}