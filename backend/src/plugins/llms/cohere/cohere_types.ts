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
