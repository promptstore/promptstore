export interface CohereChatMessage {
  role: string;  // One of CHATBOT|USER to identify who the message is coming from.
  message: string;  // Contents of the chat message.
  generation_id?: string;  // Unique identifier for the generated reply. Useful for submitting feedback.
  response_id?: string;  // Unique identifier for the response.
}

interface CohereConnector {
  id: string;  // The identifier of the connector.
  user_access_token?: string;  // When specified, this user access token will be passed to the connector in the Authorization header instead of the Cohere generated one.
  continue_on_failure?: boolean;  // Defaults to false. When true, the request will continue if this connector returned an error.
  options?: object;  // Provides the connector with different settings at request time. The key/value pairs of this object are specific to each connector. For example, the connector web-search supports the site option, which limits search results to the specified domain.
}

export interface CohereTool {
  name: string;  // The name of the tool to be called.
  description: string;  // The description of what the tool does, the model uses the description to choose when and how to call the function.
  parameter_definitions: object;
}

interface CohereToolCall {
  name: string;  // The tool name.
  parameters: object;  // The parameter values as key-value pairs.
  generation_id: string;
}

interface CohereToolResult {
  call: CohereToolCall;
  outputs: object[];  // The results of the tool call as key-value pairs.
}

/**
 * prompt_truncation:
 * With prompt_truncation set to "AUTO", some elements from chat_history and documents will be dropped in an attempt to construct a prompt that fits within the model's context length limit. During this process the order of the documents and chat history will be changed and ranked by relevance.
 * With prompt_truncation set to "AUTO_PRESERVE_ORDER", some elements from chat_history and documents will be dropped in an attempt to construct a prompt that fits within the model's context length limit. During this process the order of the documents and chat history will be preserved as they are inputted into the API.
 * With prompt_truncation set to "OFF", no elements will be dropped. If the sum of the inputs exceeds the model's context length limit, a TooManyTokens error will be returned.
 * 
 * documents:
 * An id field (string) can be optionally supplied to identify the document in the citations. This field will not be passed to the model.
 * An _excludes field (array of strings) can be optionally supplied to omit some key-value pairs from being shown to the model. The omitted fields will still show up in the citation object. The "_excludes" field will not be passed to the model.
 */
export interface CohereChatCompletionRequest {
  message: string;  // Text input for the model to respond to.
  model?: string;  // Defaults to "command". The name of a compatible Cohere model or the ID of a fine-tuned model.
  stream?: boolean;  // Defaults to false. When true, the response will be a JSON stream of events. The final event will contain the complete response, and will have an event_type of "stream-end".
  preamble?: string;  // The system prompt. When specified, the default Cohere preamble will be replaced with the provided one. Preambles are a part of the prompt used to adjust the model's overall behavior and conversation style.
  chat_history?: CohereChatMessage[];
  conversation_id?: string;  // An alternative to chat_history. Providing a conversation_id creates or resumes a persisted conversation with the specified ID. The ID can be any non empty string.
  prompt_truncation?: string;  // Defaults to AUTO when connectors are specified and OFF in all other cases.
  connectors?: CohereConnector[];  // Accepts {"id": "web-search"}, and/or the "id" for a custom connector, if you've created one.
  search_queries_only?: boolean;  // Defaults to false. When true, the response will only contain a list of generated search queries, but no search will take place, and no reply from the model to the user's message will be generated.
  documents?: object[];  // A list of relevant documents that the model can cite to generate a more accurate reply. Each document is a string-string dictionary. Some suggested keys are "text", "author", and "date". For better generation quality, it is recommended to keep the total word count of the strings in the dictionary to under 300 words.
  temperature?: number;  // Defaults to 0.3.
  max_tokens?: number;  // The maximum number of tokens the model will generate as part of the response. Note: Setting a low value may result in incomplete generations.
  k?: number;  // Ensures only the top k most likely tokens are considered for generation at each step. Defaults to 0, min value of 0, max value of 500.
  p?: number;  // Ensures that only the most likely tokens, with total probability mass of p, are considered for generation at each step. If both k and p are enabled, p acts after k. Defaults to 0.75. min value of 0.01, max value of 0.99.
  frequency_penalty?: number;  // Defaults to 0.0, min value of 0.0, max value of 1.0.
  presence_penalty?: number;  // Defaults to 0.0, min value of 0.0, max value of 1.0.
  tools?: CohereTool[];  // A list of available tools (functions) that the model may suggest invoking before producing a text response.
  tool_results?: CohereToolResult[];  // A list of results from invoking tools. Results are used to generate text and will be referenced in citations. When using tool_results, tools must be passed as well. Each tool_result contains information about how it was invoked, as well as a list of outputs in the form of dictionaries.
}

interface CohereCitation {
  start: number;  // The index of text that the citation starts at, counting from zero. For example, a generation of Hello, world! with a citation on world would have a start value of 7. This is because the citation starts at w, which is the seventh character.
  end: number;  // The index of text that the citation ends after, counting from zero. For example, a generation of Hello, world! with a citation on world would have an end value of 11. This is because the citation ends after d, which is the eleventh character.
  text: string;  // The text of the citation. For example, a generation of Hello, world! with a citation of world would have a text value of world.
  document_ids: string[];  // Identifiers of documents cited by this section of the generated reply.
}

interface CohereSearchQuery {
  text: string;  // The text of the search query.
  generation_id: string;  // Unique identifier for the generated search query. Useful for submitting feedback.
}

interface CohereSearchResult {
  search_query: CohereSearchQuery;  // The generated search query. Contains the text of the query and a unique identifier for the query.
  connector?: CohereConnector;  // The connector from which this result comes from.
  document_ids: string[];  // Identifiers of documents found by this search query.
}

enum CohereFinishReason {
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR',
  ERROR_TOXIC = 'ERROR_TOXIC',
  ERROR_LIMIT = 'ERROR_LIMIT',
  USER_CANCEL = 'USER_CANCEL',
  MAX_TOKENS = 'MAX_TOKENS',
}

export interface CohereChatCompletionResponse {
  text: string;  // Contents of the reply generated by the model.
  generation_id?: string;  // Unique identifier for the generated reply. Useful for submitting feedback.
  citations?: CohereCitation[];  // Inline citations for the generated reply.
  documents?: object[];  // Documents seen by the model when generating the reply.
  is_search_required?: boolean;  // Denotes that a search for documents is required during the RAG flow.
  search_queries?: CohereSearchQuery[];  // Generated search queries, meant to be used as part of the RAG flow.
  search_results?: CohereSearchResult[];  // Documents retrieved from each of the conducted searches.
  finish_reason?: CohereFinishReason;
  tool_calls?: CohereToolCall[];  // Contains the tool calls generated by the model. Use it to invoke your tools.
  chat_history?: CohereChatMessage[];  // A list of previous messages between the user and the model, meant to give the model conversational context for responding to the user's message.
}

export interface CohereEmbeddingRequest {
  texts: string[];  // An array of strings for the model to embed. Maximum number of texts per call is 96. We recommend reducing the length of each text to be under 512 tokens for optimal quality.
  model?: string;  // Defaults to embed-english-v2.0
  inputType: string;  // Specifies the type of input passed to the model.
  embeddingTypes?: string[];  // Specifies the types of embeddings you want to get back. Not required and default is None, which returns the Embed Floats response type. 
  truncate?: string;  // One of NONE|START|END to specify how the API will handle inputs longer than the maximum token length.
}

interface CohereEmbeddingApiVersion {
  version: string;
  is_deprecated?: boolean;
  is_experimental?: boolean;
}

interface CohereEmbeddingUsage {
  input_tokens: number;
  output_tokens: number;
  search_units: number;
  classifications: number;
}

interface CohereEmbeddingMetadata {
  api_version: CohereEmbeddingApiVersion;
  billed_units: CohereEmbeddingUsage;
  warnings: string[];
}

export interface CohereEmbeddingResponse {
  response_type?: string;
  id: string;
  embeddings: number[][];
  texts: string[];
  meta: CohereEmbeddingMetadata;
}

export interface CohereCompletionRequest {
  prompt: string;  // The input text that serves as the starting point for generating the response. Note: The prompt will be pre-processed and modified before reaching the model.
  model?: string;  // The identifier of the model to generate with. Currently available models are command (default), command-nightly (experimental), command-light, and command-light-nightly (experimental).
  num_generations?: number;  // The maximum number of generations that will be returned. Defaults to 1, min value of 1, max value of 5.
  stream?: boolean;  // When true, the response will be a JSON stream of events. The final event will contain the complete response, and will contain an is_finished field set to true. The event will also contain a finish_reason, which can be one of the following: - COMPLETE - the model sent back a finished reply - MAX_TOKENS - the reply was cut off because the model reached the maximum number of tokens for its context length - ERROR - something went wrong when generating the reply - ERROR_TOXIC - the model generated a reply that was deemed toxic
  max_tokens?: number;  // The maximum number of tokens the model will generate as part of the response. Note: Setting a low value may result in incomplete generations. This parameter is off by default, and if it's not specified, the model will continue generating until it emits an EOS completion token. See BPE Tokens for more details. Can only be set to 0 if return_likelihoods is set to ALL to get the likelihood of the prompt.
  truncate?: string;  // One of NONE|START|END to specify how the API will handle inputs longer than the maximum token length. Default: END
  temperature?: number;  // A non-negative float that tunes the degree of randomness in generation. Lower temperatures mean less random generations. See Temperature for more details. Defaults to 0.75, min value of 0.0, max value of 5.0.
  preset?: string;  // Identifier of a custom preset. A preset is a combination of parameters, such as prompt, temperature etc. You can create presets in the playground.
  end_sequences?: string[];  // The generated text will be cut at the beginning of the earliest occurrence of an end sequence. The sequence will be excluded from the text.
  stop_sequences?: string[];  // The generated text will be cut at the end of the earliest occurrence of a stop sequence. The sequence will be included the text.
  k?: number;  // Ensures only the top k most likely tokens are considered for generation at each step. Defaults to 0, min value of 0, max value of 500.
  p?: number;  // Ensures that only the most likely tokens, with total probability mass of p, are considered for generation at each step. If both k and p are enabled, p acts after k. Defaults to 0.75. min value of 0.01, max value of 0.99.
  frequency_penalty?: number;  // Used to reduce repetitiveness of generated tokens. The higher the value, the stronger a penalty is applied to previously present tokens, proportional to how many times they have already appeared in the prompt or prior generation.
  presence_penalty?: number;  // Defaults to 0.0, min value of 0.0, max value of 1.0. Can be used to reduce repetitiveness of generated tokens. Similar to frequency_penalty, except that this penalty is applied equally to all tokens that have already appeared, regardless of their exact frequencies.
  return_likelihoods?: string;  // One of GENERATION|ALL|NONE to specify how and if the token likelihoods are returned with the response. Defaults to NONE. If GENERATION is selected, the token likelihoods will only be provided for generated text. If ALL is selected, the token likelihoods will be provided both for the prompt and the generated text. Default: NONE
  logit_bias?: object;  // Used to prevent the model from generating unwanted tokens or to incentivize it to include desired tokens. The format is {token_id: bias} where bias is a float between -10 and 10. Tokens can be obtained from text using Tokenize.
}

interface CohereTokenLikelihood {
  token: string;
  likelihood: number;
}

interface CohereBilledUnits {
  input_tokens?: number;
  output_tokens?: number;
  search_units?: number;
  classifications?: number;
}

interface CohereApiVersion {
  version: string;
  is_deprecated?: boolean;
  is_experimental?: boolean;
  billed_units?: CohereBilledUnits;
}

interface CohereGenerationMetadata {
  api_version: CohereApiVersion;
  warnings: string[];
}

interface CohereGeneration {
  id: string;
  text: string;
  index?: number;  // Refers to the nth generation. Only present when num_generations is greater than zero.
  likelihood?: number;
  token_likelihoods?: CohereTokenLikelihood[];  // Only returned if return_likelihoods is set to GENERATION or ALL. The likelihood refers to the average log-likelihood of the entire specified string, which is useful for evaluating the performance of your model, especially if you've created a custom model. Individual token likelihoods provide the log-likelihood of each token. The first token will not have a likelihood.
  finish_reason?: string;
}

export interface CohereCompletionResponse {
  id: string;
  prompt?: string;
  generations: CohereGeneration[];
  meta?: CohereGenerationMetadata;
}