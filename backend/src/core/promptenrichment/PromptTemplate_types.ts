import { Validator } from '../common_types';
import { Callback } from '../callbacks/Callback';
import { Message } from '../conversions/RosettaStone';

export type TemplateFiller = (content: string, args: object) => string;

export interface PromptTemplateOnStartResponse {
  args: any;
  isBatch: boolean;
  messageTemplates: Message[];
}

export interface OnPromptTemplateEndParams {
  messages?: Message[];
  errors?: any;
}

export interface PromptTemplateOnEndResponse {
  messages?: Message[];
  errors?: any;
}

export type PromptTemplateOnStartCallbackFunction = (params: PromptTemplateOnStartResponse) => void;

export type PromptTemplateOnEndCallbackFunction = (params: PromptTemplateOnEndResponse) => void;

export type PromptTemplateOnErrorCallbackFunction = (errors: any) => void;

export interface PromptTemplateParams {
  messages: Message[];
  schema?: object;
  templateEngine?: string;
  templateFiller?: TemplateFiller;
  validator?: Validator;
  callbacks?: Callback[];
}

export interface PromptTemplateCallParams {
  args: any;
  isBatch: boolean;
  messages?: Message[];
  contextWindow: number;
  maxTokens: number;
  modelKey: string;
  callbacks?: Callback[];
}
