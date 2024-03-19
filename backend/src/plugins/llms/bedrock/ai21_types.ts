export interface AI21PenaltyObject {
  scale: number;
  applyToWhitespaces?: boolean;
  applyToPunctuations?: boolean;
  applyToNumbers?: boolean;
  applyToStopwords?: boolean;
  applyToEmojis?: boolean;
}

interface AI21Message {
  text: string;
  role: string;  // one of ['user', 'assistant']
}

export interface AI21ChatCompletionRequest {
  model_type: string;  // one of ['light', 'mid', 'ultra']
  messages: AI21Message[];
  system: string;  // system prompt
  numResults?: number;
  maxTokens?: number;
  minTokens?: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
  topKReturn?: number;
  frequencyPenalty?: AI21PenaltyObject;
  presencePenalty?: AI21PenaltyObject;
  countPenalty?: AI21PenaltyObject;
}

export interface AI21ChatCompletionResponse {
  id: string;
  outputs: AI21Message[];
}

export interface AI21CompletionRequest {
  model_type: string;  // one of ['light', 'mid', 'ultra']
  prompt: string;
  numResults?: number;
  maxTokens?: number;
  minTokens?: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
  topKReturn?: number;
  frequencyPenalty?: AI21PenaltyObject;
  presencePenalty?: AI21PenaltyObject;
  countPenalty?: AI21PenaltyObject;
}

interface AI21GeneratedTokenObject {
  token: string;
  logprob: number;
  raw_logprob: number;
}

interface AI21TextRange {
  start: number;
  end: number;
}

interface AI21TokenObject {
  generatedToken: AI21GeneratedTokenObject;
  topTokens: string;
  textRange: AI21TextRange;
}

interface AI21PromptObject {
  text: string;
  tokens: AI21TokenObject[];

}

interface AI21CompletionData {
  text: string;
  tokens: AI21TokenObject[];
}

interface AI21FinishReason {
  reason: string;
  length: number;
}

interface AI21Completion {
  data: AI21CompletionData;
  finishReason: AI21FinishReason;
}

export interface AI21CompletionResponse {
  id: string;
  prompt: AI21PromptObject;
  completions: AI21Completion[];
}