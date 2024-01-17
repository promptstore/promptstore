import relativeTime from 'dayjs/plugin/relativeTime';
import { default as dayjs } from 'dayjs';
import { ValidatorResult, validate } from 'jsonschema';
import type * as tiktoken from 'js-tiktoken';
import { encodingForModel, getEncoding } from 'js-tiktoken';

import logger from '../../logger';
import { fillTemplate } from '../../utils';

import { Validator } from '../common_types';
import { SchemaError } from '../errors';
import { Callback } from '../callbacks/Callback';
import { convertMessagesWithImages } from '../utils';
import {
  OnPromptTemplateEndParams,
  PromptTemplateParams,
  PromptTemplateCallParams,
  TemplateFiller,
} from './PromptTemplate_types';
import {
  CitationMetadata,
  ContentType,
  FunctionCall,
  Message,
  MessageRole,
  convertContentTypeToString,
  fillContent,
} from '../conversions/RosettaStone';

dayjs.extend(relativeTime);

export class PromptTemplate {

  messages: Message[];
  schema?: object;
  templateFiller?: TemplateFiller;
  validator?: Validator;
  callbacks: Callback[];
  currentCallbacks: Callback[];

  constructor({
    messages,
    schema,
    templateEngine,
    templateFiller,
    validator,
    callbacks,
  }: PromptTemplateParams) {
    this.messages = messages;
    this.schema = schema;
    this.templateFiller =
      templateFiller ||
      ((content: string, args: object) => fillTemplate(content, args, templateEngine)) as TemplateFiller
      ;
    this.validator = validator || validate;
    this.callbacks = callbacks || [];
  }

  async call({ args, isBatch, messages, contextWindow, maxTokens, modelKey, callbacks = [] }: PromptTemplateCallParams) {
    this.currentCallbacks = [...this.callbacks, ...callbacks];
    await this.onStart({ args, isBatch, contextWindow, maxTokens, modelKey });
    try {
      // logger.debug('args:', args);
      if (this.schema) {
        this.validate(args, this.schema);
      }
      if (args.context) {
        // check if context length will fit within the model's context window
        args = this.checkContextLength(args, contextWindow, maxTokens, modelKey);
        // logger.debug('new args:', args);
      }
      const _messages = this.messages.map((message) => ({
        role: message.role,
        content: fillContent(this.templateFiller, args, message.content),
      }));
      // append the enriched messages to the enriched prompts
      if (messages) {
        _messages.push(...messages.map((message) => ({
          role: message.role,
          content: fillContent(this.templateFiller, args, message.content),
        })));
      }
      this.onEnd({ messages: await convertMessagesWithImages(_messages) });
      return _messages;
    } catch (err) {
      const errors = err.errors || [{ message: String(err) }];
      this.onEnd({ errors });
      throw err;
    }
  }

  checkContextLength(args: any, contextWindow: number, maxTokens: number, modelKey: string) {
    logger.debug('checking context length');
    // logger.debug('model: %s, context window: %d, args:', modelKey, contextWindow, args);
    const model = modelKey as tiktoken.TiktokenModel;
    let encoding: tiktoken.Tiktoken;
    try {
      encoding = encodingForModel(model);
    } catch (err) {
      encoding = getEncoding('gpt2');
    }
    const preContextArgs = { ...args, context: '' };
    const preContextText = this.messages
      .map(m => this.templateFiller(convertContentTypeToString(m.content), preContextArgs))
      .join('\n\n');
    const preContextTokens = encoding.encode(preContextText);
    const preContextLength = preContextTokens.length;
    // logger.debug('pre context length:', preContextLength);
    const available = contextWindow - preContextLength - maxTokens;
    // logger.debug('available length:', available);
    const contextTokens = encoding.encode(args.context);
    const contextLength = contextTokens.length;
    // logger.debug('context length:', contextLength);
    let context: string;
    if (contextLength > available) {
      logger.debug('context length > available', contextLength, available);
      logger.debug('culling...');
      context = args.context.slice(0, available);
    } else {
      context = args.context;
    }
    return { ...args, context };
  }

  validate(instance: object, schema: object) {
    const validatorResult = this.validator(instance, schema, { required: true });
    for (let callback of this.currentCallbacks) {
      callback.onValidateArguments(validatorResult);
    }
    if (!validatorResult.valid) {
      this.throwSchemaError(validatorResult);
    }
  }

  async onStart({ args, isBatch }: PromptTemplateCallParams) {
    for (let callback of this.currentCallbacks) {
      callback.onPromptTemplateStart({
        messageTemplates: await convertMessagesWithImages(this.messages),
        args,
        isBatch,
      });
    }
  }

  onEnd({ messages, errors }: OnPromptTemplateEndParams) {
    for (let callback of this.currentCallbacks) {
      callback.onPromptTemplateEnd({
        messages,
        errors,
      });
    }
  }

  throwSchemaError(validatorResult: ValidatorResult) {
    for (let callback of this.currentCallbacks) {
      callback.onPromptTemplateError(validatorResult.errors);
    }
    throw new SchemaError(validatorResult);
  }

}

export class ChatMessage implements Message {

  role: MessageRole;
  content: ContentType;
  name?: string;
  function_call?: FunctionCall;
  citation_metadata?: CitationMetadata;

  constructor({ role, content, name, function_call, citation_metadata }: Message) {
    this.role = role;
    this.content = content;
    this.name = name;
    this.function_call = function_call;
    this.citation_metadata = citation_metadata;
  }

}

export function message(params: Message) {
  return new ChatMessage(params);
}

interface PromptTemplateOptions {
  schema?: object;
  templateEngine?: string;
  callbacks?: Callback[];
}

export const promptTemplate = (options: PromptTemplateOptions) => (messages: Message[]) => {
  return new PromptTemplate({
    ...options,
    messages,
  });
}
