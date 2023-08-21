import {
  CitationMetadata,
  ContentFilter,
  SafetyFeedback,
  SafetyRating,
  SafetySetting,
} from './RosettaStone';

export interface PaLMMessage {
  author?: string;  // The author of this Message. This serves as a key for tagging the content of this Message when it is fed to the model as text. The author can be any alphanumeric string.
  content: string;  // The text content of the structured Message.
  citation_metadata?: CitationMetadata;  // Output only. Citation information for model-generated content in this Message. If this Message was generated as output from the model, this field may be populated with attribution information for any text included in the content.
}

export interface PaLMExample {
  input: PaLMMessage;  // An example of an input Message from the user.
  output: PaLMMessage;  // An example of what the model should output given the input.
}

interface PaLMMessagePrompt {
  context?: string;  // Text that should be provided to the model first to ground the response. If not empty, this context will be given to the model first before the examples and messages. If the total input size exceeds the model's input_token_limit the input will be truncated: The oldest items will be dropped from messages.
  examples?: PaLMExample[];  // Examples of what the model should generate. These examples are treated identically to conversation messages except that they take precedence over the history in messages: If the total input size exceeds the model's inputTokenLimit the input will be truncated. Items will be dropped from messages before examples.
  messages: PaLMMessage[];  // A snapshot of the recent conversation history sorted chronologically. Turns alternate between two authors. If the total input size exceeds the model's inputTokenLimit the input will be truncated: The oldest items will be dropped from messages.
}

export interface PaLMChatRequest {
  model: string;  // The name of the model to use. Format: name=models/{model}.
  prompt: PaLMMessagePrompt;  // The structured textual input given to the model as a prompt. Given a prompt, the model will return what it predicts is the next message in the discussion.
  temperature?: number;  // Controls the randomness of the output. Must be positive. Typical values are in the range: [0.0,1.0]. Higher values produce a more random and varied response. A temperature of zero will be deterministic.
  candidate_count?: number;  // The maximum number of generated response messages to return. This value must be between [1, 8], inclusive. If unset, this will default to 1.
  top_p?: number;  // top_p configures the nucleus sampling. It sets the maximum cumulative probability of tokens to sample from. For example, if the sorted probabilities are [0.5, 0.2, 0.1, 0.1, 0.05, 0.05] a top_p of 0.8 will sample as [0.625, 0.25, 0.125, 0, 0, 0].
  top_k?: number;  // The maximum number of tokens to consider when sampling.. The API uses combined nucleus and top-k sampling. top_k sets the maximum number of tokens to sample from on each step.
}

export interface PaLMChatResponse {
  candidates: PaLMMessage[];  // A list of candidate responses from the model.
  messages: PaLMMessage[];  // A snapshot of the conversation history sorted chronologically. (Equivalent to prepended messages in OpenAI.)
  filters: ContentFilter[];  // This indicates which `types.SafetyCategory`(s) blocked a candidate from this response, the lowest `HarmProbability` that triggered a block, and the `HarmThreshold` setting for that category.
}

interface TextPrompt {
  text: string;  // The prompt text.
}

export interface PaLMCompletionRequest {
  model: string;
  prompt: TextPrompt;
  temperature?: number;  // Controls the randomness of the output. Note: The default value varies by model, see the Model.temperature attribute of the Model returned the getModel function. Values can range from [0.0,1.0], inclusive. A value closer to 1.0 will produce responses that are more varied and creative, while a value closer to 0.0 will typically result in more straightforward responses from the model.
  candidate_count?: number;  // The maximum number of generated response messages to return. This value must be between [1, 8], inclusive. If unset, this will default to 1.
  max_output_tokens?: number;  // The maximum number of tokens to include in a candidate. If unset, this will default to 64.
  top_p?: number;  // The maximum cumulative probability of tokens to consider when sampling. The model uses combined Top-k and nucleus sampling. Tokens are sorted based on their assigned probabilities so that only the most liekly tokens are considered. Top-k sampling directly limits the maximum number of tokens to consider, while Nucleus sampling limits number of tokens based on the cumulative probability.
  top_k?: number;  // The maximum number of tokens to consider when sampling. The model uses combined Top-k and nucleus sampling. Top-k sampling considers the set of top_k most probable tokens. Defaults to 40.
  safety_settings?: SafetySetting[];
  stop_sequences?: string | string[];  // A set of up to 5 character sequences that will stop output generation. If specified, the API will stop at the first appearance of a stop sequence. The stop sequence will not be included as part of the response.
}

interface TextCompletion {
  output: string;  // The generated text returned from the model.
  safety_ratings: SafetyRating[];  // Ratings for the safety of a response. There is at most one rating per category.
  citation_metadata: CitationMetadata;  // Output only. Citation information for model-generated output in this TextCompletion. This field may be populated with attribution information for any text included in the output.
}

export interface PaLMCompletionResponse {
  candidates: TextCompletion[];
  filters: ContentFilter[];
  safety_feedback: SafetyFeedback[];
}
