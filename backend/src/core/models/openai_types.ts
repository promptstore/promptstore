import {
  ChatCompletionUsage,
  ContentType,
  FunctionCallType,
  FunctionCall,
  Function,
  LogProbs,
  Message,
  MessageRole,
} from '../conversions/RosettaStone';

export interface OpenAIToolCall {
  id: string;  // The ID of the tool call.
  type: string;  // The type of the tool. Currently, only "function" is supported.
  function: FunctionCall;
}

export interface OpenAIMessage<T = ContentType> extends Message<T> {
  role: MessageRole;  // The role of the message author. 
  content: T;  // The contents of the message. content is required for all messages, and may be null for assistant messages with function calls.
  name?: string;  // The name of the author of this message. name is required if role is function, and it should be the name of the function whose response is in the content. May contain a-z, A-Z, 0-9, and underscores, with a maximum length of 64 characters.
  function_call?: FunctionCall;  // DEPRECATED! The name and arguments of a function that should be called, as generated by the model.
  tool_calls?: OpenAIToolCall[];  //The tool calls generated by the model, such as function calls.
  tool_call_id?: string;
}

export interface ResponseFormat {
  type: string;  // Must be one of "text" or "json_object". Defaults to text.
}

export interface OpenAITool {
  type: string;  // The type of the tool. Currently, only "function" is supported.
  function: Function;
}

export interface FunctionChoice {
  name: string;  // The name of the function to call.
}

export interface OpenAIToolChoice {
  type: string;  // The type of the tool. Currently, only "function" is supported.
  function: FunctionChoice;
}

export interface OpenAIChatCompletionRequest {
  model: string;  // ID of the model to use.
  messages: OpenAIMessage[];  // A list of messages comprising the conversation to date.
  functions?: Function[];  // DEPRECATED! A list of functions the model may generate JSON inputs for.
  function_call?: FunctionCallType | object;  // DEPRECATED! Controls how the model responds to function calls. Specifying a particular function via {"name":\ "my_function"} forces the model to call that function. "none" is the default when no functions are present. "auto" is the default if functions are present.
  temperature?: number;  // What sampling temperature to use, between 0 and 2. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic. Defaults to 1. Alter this or top_p but not both.
  top_p?: number;  // An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered. Defaults to 1. Alter this or temperature but not both.
  n?: number;  // How many chat completion choices to generate for each input message. Defaults to 1.
  stream?: boolean;  // If set, partial message deltas will be sent, like in ChatGPT. Tokens will be sent as data-only server-sent events as they become available, with the stream terminated by a data: [DONE] message. Defaults to false.
  stop?: string | string[];  // Up to 4 sequences where the API will stop generating further tokens. Defaults to null.
  max_tokens?: number;  // The maximum number of tokens to generate in the chat completion. The total length of input tokens and generated tokens is limited by the model's context length. Defaults to inf.
  presence_penalty?: number;  // Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics. Defaults to 0.
  frequency_penalty?: number;  // Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim. Defaults to 0.
  logit_bias?: any;  // Modify the likelihood of specified tokens appearing in the completion. Accepts a json object that maps tokens (specified by their token ID in the tokenizer) to an associated bias value from -100 to 100. Mathematically, the bias is added to the logits generated by the model prior to sampling. The exact effect will vary per model, but values between -1 and 1 should decrease or increase likelihood of selection; values like -100 or 100 should result in a ban or exclusive selection of the relevant token. Defaults to null.
  user?: string;  // A unique identifier representing your end-user.
  seed?: number;  // This feature is in Beta. If specified, our system will make a best effort to sample deterministically, such that repeated requests with the same seed and parameters should return the same result. Determinism is not guaranteed, and you should refer to the system_fingerprint response parameter to monitor changes in the backend.
  response_format?: ResponseFormat;
  tools?: OpenAITool[];  // A list of tools the model may call. Currently, only functions are supported as a tool. Use this to provide a list of functions the model may generate JSON inputs for.
  tool_choice?: string | OpenAIToolChoice;  // Controls which (if any) function is called by the model. none means the model will not call a function and instead generates a message. auto means the model can pick between generating a message or calling a function. Specifying a particular function via {"type: "function", "function": {"name": "my_function"}} forces the model to call that function. "none" is the default when no functions are present. "auto" is the default if functions are present.
}

interface OpenAIChatCompletionChoice {
  finish_reason: string;
  index: number;
  message: OpenAIMessage;
}

export interface OpenAIChatCompletionResponse {
  id: string;
  object: string;
  created: Date;
  model: string;
  choices: OpenAIChatCompletionChoice[];
  usage: ChatCompletionUsage;
};

export interface OpenAICompletionRequest {
  model: string;  // ID of the model to use.
  prompt: string | string[];  // The prompt(s) to generate completions for, encoded as a string, array of strings, array of tokens, or array of token arrays. Note that <|endoftext|> is the document separator that the model sees during training, so if a prompt is not specified the model will generate as if from the beginning of a new document.
  suffix?: string;  // The suffix that comes after a completion of inserted text.
  max_tokens?: number;  // The maximum number of tokens to generate in the completion.
  temperature?: number;  // What sampling temperature to use, between 0 and 2. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic. We generally recommend altering this or top_p but not both.
  top_p?: number;  // An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered.
  n?: number;  // How many completions to generate for each prompt.
  stream?: boolean;  // Whether to stream back partial progress. If set, tokens will be sent as data-only server-sent events as they become available, with the stream terminated by a data: [DONE] message.
  logprobs?: number;  // Include the log probabilities on the logprobs most likely tokens, as well the chosen tokens. For example, if logprobs is 5, the API will return a list of the 5 most likely tokens. The API will always return the logprob of the sampled token, so there may be up to logprobs+1 elements in the response. The maximum value for logprobs is 5.
  echo?: boolean;  // Echo back the prompt in addition to the completion.
  stop?: string | string[];  // Up to 4 sequences where the API will stop generating further tokens. The returned text will not contain the stop sequence.
  presence_penalty?: number;  // Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics.
  frequency_penalty?: number;  // Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim.
  best_of?: number;  // Generates best_of completions server-side and returns the "best" (the one with the highest log probability per token). Results cannot be streamed. When used with n, best_of controls the number of candidate completions and n specifies how many to return – best_of must be greater than n.
  logit_bias?: object;  // Modify the likelihood of specified tokens appearing in the completion. Accepts a json object that maps tokens (specified by their token ID in the GPT tokenizer) to an associated bias value from -100 to 100. You can use this tokenizer tool (which works for both GPT-2 and GPT-3) to convert text to token IDs. Mathematically, the bias is added to the logits generated by the model prior to sampling. The exact effect will vary per model, but values between -1 and 1 should decrease or increase likelihood of selection; values like -100 or 100 should result in a ban or exclusive selection of the relevant token. As an example, you can pass {"50256": -100} to prevent the <|endoftext|> token from being generated.
  user?: string;  // A unique identifier representing your end-user, which can help OpenAI to monitor and detect abuse.
}

interface CompletionChoice {
  text: string;
  index: number;
  logprobs?: LogProbs;
  finish_reason: string;
}

export interface OpenAICompletionResponse {
  id: string;  // A unique identifier for the completion.
  object: string;  // The object type, which is always "text_completion"
  created: Date;
  model: string;
  choices: CompletionChoice[];  // The list of completion choices the model generated for the input prompt.
  usage: ChatCompletionUsage;
}

export interface OpenAIImageResponse {
  b64_json?: string;
  url?: string;
  revised_prompt: string;
}