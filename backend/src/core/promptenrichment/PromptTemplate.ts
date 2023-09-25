import relativeTime from 'dayjs/plugin/relativeTime';
import { default as dayjs } from 'dayjs';
import { ValidatorResult, validate } from 'jsonschema';

import { fillTemplate } from '../../utils';

import { Validator } from '../common_types';
import { SchemaError } from '../errors';
import { Callback } from '../callbacks/Callback';
import {
  OnPromptTemplateEndParams,
  PromptTemplateParams,
  PromptTemplateCallParams,
  TemplateFiller,
} from './PromptTemplate_types';
import { CitationMetadata, FunctionCall, Message, MessageRole } from '../conversions/RosettaStone';

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

  call({ args, callbacks = [] }: PromptTemplateCallParams) {
    this.currentCallbacks = [...this.callbacks, ...callbacks];
    this.onStart({ args });
    try {
      if (this.schema) {
        this.validate(args, this.schema);
      }
      const messages = this.messages.map((message) => ({
        role: message.role,
        content: this.templateFiller(message.content, args),
      }));
      this.onEnd({ messages });
      return messages;
    } catch (err) {
      const errors = err.errors || [{ message: String(err) }];
      this.onEnd({ errors });
      throw err;
    }
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

  onStart({ args }: PromptTemplateCallParams) {
    for (let callback of this.currentCallbacks) {
      callback.onPromptTemplateStart({
        messageTemplates: this.messages,
        args,
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
  content: string;
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
