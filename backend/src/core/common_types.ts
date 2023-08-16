import { ValidatorResult } from 'jsonschema';

import { IMessage } from './PromptTemplate_types';

export interface ChatCompletionChoice {
  finish_reason: string;
  index: number;
  message: IMessage;
}

interface ChatCompletionUsage {
  completion_tokens: number;
  prompt_tokens: number;
  total_tokens: number;
}

export interface Function {
  name: string;  // The name of the function to be called. Must be a-z, A-Z, 0-9, or contain underscores and dashes, with a maximum length of 64.
  description?: string;  // A description of what the function does, used by the model to choose when and how to call the function.
  parameters: object;  // JSONSchema document that describes the function and arguments.
}

enum FunctionCallType {
  none = 'none',  // "none" means the model does not call a function, and responds to the end-user.
  auto = 'auto',  // "auto" means the model can pick between an end-user or calling a function.
}

export interface OpenAIChatCompletionRequest {
  model: string;  // ID of the model to use.
  messages: IMessage[];  // A list of messages comprising the conversation to date.
  functions?: Function[];  // A list of functions the model may generate JSON inputs for.
  function_call?: FunctionCallType | object;  // Controls how the model responds to function calls. Specifying a particular function via {"name":\ "my_function"} forces the model to call that function. "none" is the default when no functions are present. "auto" is the default if functions are present.
  temperature?: number;  // What sampling temperature to use, between 0 and 2. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic. Defaults to 1. Alter this or top_p but not both.
  top_p?: number;  // An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered. Defaults to 1. Alter this or temperature but not both.
  n?: number;  // How many chat completion choices to generate for each input message. Defaults to 1.
  stream?: boolean;  // If set, partial message deltas will be sent, like in ChatGPT. Tokens will be sent as data-only server-sent events as they become available, with the stream terminated by a data: [DONE] message. Defaults to false.
  stop?: string | string[];  // Up to 4 sequences where the API will stop generating further tokens. Defaults to null.
  max_tokens?: number;  // The maximum number of tokens to generate in the chat completion. The total length of input tokens and generated tokens is limited by the model's context length. Defaults to inf.
  presence_penalty?: number;  // Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics. Defaults to 0.
  frequency_penalty?: number;  // Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim. Defaults to 0.
  logit_bias?: object;  // Modify the likelihood of specified tokens appearing in the completion. Accepts a json object that maps tokens (specified by their token ID in the tokenizer) to an associated bias value from -100 to 100. Mathematically, the bias is added to the logits generated by the model prior to sampling. The exact effect will vary per model, but values between -1 and 1 should decrease or increase likelihood of selection; values like -100 or 100 should result in a ban or exclusive selection of the relevant token. Defaults to null.
  user?: string;  // A unique identifier representing your end-user.
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: Date;
  model: string;
  choices: ChatCompletionChoice[];
  usage: ChatCompletionUsage;
};

interface CompletionChoice {
  text: string;
  index: number;
  logprobs?: object;
  finish_reason: string;
}

export interface CompletionResponse {
  id: string;  // A unique identifier for the completion.
  object: string;  // The object type, which is always "text_completion"
  created: Date;
  model: string;
  choices: CompletionChoice[];  // The list of completion choices the model generated for the input prompt.
  usage: ChatCompletionUsage;
}

export type DataMapper = (instance: object, template: any) => Promise<object>;

export type Constructor = new (...args: any[]) => {};
export type GConstructor<T = {}> = new (...args: any[]) => T;

export type Validator = (args: any, schema: object, options: object) => ValidatorResult;

export interface MapArgumentsResponse {
  args: any;
  mapped: any;
  isBatch: boolean;
  mappingTemplate: any;
}

export interface MapReturnTypeResponse {
  response: any;
  mapped: any;
  isBatch: boolean;
  mappingTemplate: any;
}
