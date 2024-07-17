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

  promptSetId: number;
  promptSetName: string;
  messages: Message[];
  schema?: object;
  snippets?: object;
  templateFiller?: TemplateFiller;
  validator?: Validator;
  callbacks: Callback[];

  constructor({
    promptSetId,
    promptSetName,
    messages,
    schema,
    snippets,
    templateEngine,
    templateFiller,
    validator,
    callbacks,
  }: PromptTemplateParams) {
    this.promptSetId = promptSetId;
    this.promptSetName = promptSetName;
    this.messages = messages;
    this.schema = schema;
    this.snippets = snippets;
    this.templateFiller =
      templateFiller ||
      ((content: string, args: object) => fillTemplate(content, args, templateEngine)) as TemplateFiller
      ;
    this.validator = validator || validate;
    this.callbacks = callbacks || [];
  }

  async call({ args, isBatch, messages, contextWindow, maxOutputTokens, maxTokens, model, callbacks }: PromptTemplateCallParams) {
    let _callbacks: Callback[];
    if (callbacks?.length) {
      _callbacks = callbacks;
    } else {
      _callbacks = this.callbacks;
    }
    await this.onStart({ args, isBatch, contextWindow, maxTokens, model }, _callbacks);
    try {
      // logger.debug('args:', args);
      if (this.schema) {
        this.validate(args, this.schema, _callbacks);
      }
      if (args.context) {
        // check if context length will fit within the model's context window
        args = this.checkContextLength(args, contextWindow, maxOutputTokens, maxTokens, model);
        // logger.debug('new args:', args);
      }
      const myargs = { ...args, ...this.snippets };
      const _messages = this.messages.map((message) => ({
        role: message.role,
        content: fillContent(this.templateFiller, myargs, message.content),
      }));
      // append the enriched messages to the enriched prompts
      if (messages) {
        _messages.push(...messages.map((message) => ({
          role: message.role,
          content: fillContent(this.templateFiller, myargs, message.content),
        })));
      }
      this.onEnd({ messages: await convertMessagesWithImages(_messages) }, _callbacks);
      return _messages;
    } catch (err) {
      const errors = err.errors || [{ message: String(err) }];
      this.onEnd({ errors }, _callbacks);
      throw err;
    }
  }

  checkContextLength(args: any, contextWindow: number, maxOutputTokens: number, maxTokens: number, model: string) {
    logger.debug('checking context length');
    // logger.debug('model: %s, context window: %d, max output tokens: %d, args:', model, contextWindow, maxOutputTokens, args);
    const mod = model as tiktoken.TiktokenModel;
    let encoding: tiktoken.Tiktoken;
    try {
      encoding = encodingForModel(mod);
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

    // Use `maxTokens` as a proxy for how many tokens will be generated
    let available: number;
    // Some models specify a `maxOutputTokens`
    if (maxOutputTokens) {
      available = Math.min(contextWindow - preContextLength - Math.min(maxTokens, maxOutputTokens), maxOutputTokens);
    } else {
      available = contextWindow - preContextLength - maxTokens;
    }

    // logger.debug('available length:', available);
    const contextTokens = encoding.encode(args.context);
    const contextLength = contextTokens.length;
    // logger.debug('context length:', contextLength);
    let context: string;
    if (contextLength > available) {
      logger.debug('context length > available', contextLength, available);
      logger.debug('culling...');

      // Don't cull the citation
      let diff = contextLength - available;
      const splits = args.context.split(/\nCitation:/);
      let newSplits = [...splits];
      for (let i = splits.length - 2; i >= 0 && diff > 0; i -= 2) {
        const text = splits[i];
        const tokens = encoding.encode(text);
        const n = tokens.length;
        if (n > diff) {
          newSplits[i] = text.slice(0, n - diff);
          break;
        }
        newSplits.splice(i, 2);

        // est. length of citation is 70 tokens
        diff -= n + 40;
      }
      context = newSplits.join('\nCitation:');
    } else {
      context = args.context;
    }
    return { ...args, context };
  }

  validate(instance: object, schema: object, callbacks: Callback[]) {
    const validatorResult = this.validator(instance, schema, { required: true });
    for (let callback of callbacks) {
      callback.onValidateArguments(validatorResult);
    }
    if (!validatorResult.valid) {
      this.throwSchemaError(validatorResult, callbacks);
    }
  }

  async onStart({ args, isBatch }: PromptTemplateCallParams, callbacks: Callback[]) {
    for (let callback of callbacks) {
      callback.onPromptTemplateStart({
        promptSetId: this.promptSetId,
        promptSetName: this.promptSetName,
        messageTemplates: await convertMessagesWithImages(this.messages),
        args,
        isBatch,
      });
    }
  }

  onEnd({ messages, errors }: OnPromptTemplateEndParams, callbacks: Callback[]) {
    for (let callback of callbacks) {
      callback.onPromptTemplateEnd({
        messages,
        errors,
      });
    }
  }

  throwSchemaError(validatorResult: ValidatorResult, callbacks: Callback[]) {
    for (let callback of callbacks) {
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
  promptSetId: number;
  promptSetName: string;
  schema?: object;
  snippets?: object;
  templateEngine?: string;
  callbacks?: Callback[];
}

export const promptTemplate = (options: PromptTemplateOptions) => (messages: Message[]) => {
  return new PromptTemplate({
    ...options,
    messages,
  });
}
