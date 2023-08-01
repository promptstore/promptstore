import { Validator } from './common_types';
import { Trace } from './Tracer';

export type TemplateFiller = (content: string, args: object) => string;

export interface IMessage {
  role: string;
  content: string;
}

export class Message implements IMessage {

  role: string;
  content: string;

  constructor({ role, content }) {
    this.role = role;
    this.content = content;
  }

}

export class AssistantMessage implements IMessage {

  role = 'assistant';
  content: string;

  constructor(content: string) {
    this.content = content;
  }

}

export class UserMessage implements IMessage {

  role = 'user';
  content: string;

  constructor(content: string) {
    this.content = content;
  }

}

export class SystemMessage implements IMessage {

  role = 'system';
  content: string;

  constructor(content: string) {
    this.content = content;
  }

}

interface OnPromptTemplateStartResponse {
  args: any;
  messageTemplates: Message[];
  trace: Trace;
}

export interface OnPromptTemplateEndParams {
  messages: Message[];
}

export interface OnPromptTemplateEndResponse {
  messages: Message[];
  trace: Trace;
}

export type OnPromptTemplateStartCallbackFunction = (params: OnPromptTemplateStartResponse) => void;

export type OnPromptTemplateEndCallbackFunction = (params: OnPromptTemplateEndResponse) => void;

export type OnPromptTemplateErrorCallbackFunction = (errors: any) => void;

export interface PromptTemplateParams {
  messages: Message[];
  schema: object;
  templateEngine?: string;
  templateFiller?: TemplateFiller;
  validator?: Validator;
  onPromptTemplateStart?: OnPromptTemplateStartCallbackFunction;
  onPromptTemplateEnd?: OnPromptTemplateEndCallbackFunction;
  onPromptTemplateError?: OnPromptTemplateErrorCallbackFunction;
}

export interface PromptTemplateCallParams {
  args: any;
}
