import { Validator } from './common_types';
import { Callback } from './Callback';
// import { Trace } from './Tracer';

export type TemplateFiller = (content: string, args: object) => string;

enum MessageRole {
  system = 'system',
  user = 'user',
  assistant = 'assistant',
  function = 'function',
}

export interface IMessage {
  role: MessageRole;  // The role of the message author. 
  content: string;  // The contents of the message. content is required for all messages, and may be null for assistant messages with function calls.
  name?: string;  // The name of the author of this message. name is required if role is function, and it should be the name of the function whose response is in the content. May contain a-z, A-Z, 0-9, and underscores, with a maximum length of 64 characters.
  function_call?: object;  // The name and arguments of a function that should be called, as generated by the model.
}

export class Message implements IMessage {

  role: MessageRole;
  content: string;
  name?: string;
  function_call?: object;

  constructor({ role, content, name, function_call }: any) {
    this.role = role;
    this.content = content;
    this.name = name;
    this.function_call = function_call;
  }

}

export class AssistantMessage implements IMessage {

  role = MessageRole.assistant;
  content: string;
  name?: string;
  function_call?: object;

  constructor(content: string, function_call: object, name: string) {
    this.content = content;
    this.function_call = function_call;
    this.name = name;
  }

}

export class FunctionMessage implements IMessage {

  role = MessageRole.function;
  content: string;
  name: string;

  constructor(content: string, name: string) {
    this.content = content;
    this.name = name;
  }

}

export class UserMessage implements IMessage {

  role = MessageRole.user;
  content: string;
  name?: string;

  constructor(content: string, name?: string) {
    this.content = content;
    this.name = name;
  }

}

export class SystemMessage implements IMessage {

  role = MessageRole.system;
  content: string;
  name?: string;

  constructor(content: string, name: string) {
    this.content = content;
    this.name = name;
  }

}

export interface PromptTemplateOnStartResponse {
  args: any;
  messageTemplates: IMessage[];
  // trace: Trace;
}

export interface OnPromptTemplateEndParams {
  messages?: IMessage[];
  errors?: any;
}

export interface PromptTemplateOnEndResponse {
  messages?: IMessage[];
  errors?: any;
  // trace: Trace;
}

export type PromptTemplateOnStartCallbackFunction = (params: PromptTemplateOnStartResponse) => void;

export type PromptTemplateOnEndCallbackFunction = (params: PromptTemplateOnEndResponse) => void;

export type PromptTemplateOnErrorCallbackFunction = (errors: any) => void;

export interface PromptTemplateParams {
  messages: IMessage[];
  schema?: object;
  templateEngine?: string;
  templateFiller?: TemplateFiller;
  validator?: Validator;
  callbacks?: Callback[];
}

export interface PromptTemplateCallParams {
  args: any;
  callbacks?: Callback[];
}