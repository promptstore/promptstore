import * as dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { ValidatorResult, validate } from 'jsonschema';

import logger from '../logger';

import { fillTemplate } from '../utils';

import { Validator } from './common_types';
import { SchemaError } from './errors';
import {
  PromptTemplateParams,
  PromptTemplateCallParams,
  IMessage,
  Message,
  TemplateFiller,
  OnPromptTemplateEndParams,
  OnPromptTemplateStartCallbackFunction,
  OnPromptTemplateEndCallbackFunction,
  OnPromptTemplateErrorCallbackFunction,
} from './PromptTemplate_types';
import { Tracer } from './Tracer';

dayjs.extend(relativeTime);

export function message(params: IMessage) {
  return new Message(params);
}

export class PromptTemplate {

  messages: Message[];
  schema: object;
  templateFiller: TemplateFiller;
  validator: Validator;
  tracer: Tracer;
  onPromptTemplateStart?: OnPromptTemplateStartCallbackFunction;
  onPromptTemplateEnd?: OnPromptTemplateEndCallbackFunction;
  onPromptTemplateError?: OnPromptTemplateErrorCallbackFunction;
  startTime: Date;

  constructor({
    messages,
    schema,
    templateEngine,
    templateFiller,
    validator,
    onPromptTemplateStart,
    onPromptTemplateEnd,
    onPromptTemplateError,
  }: PromptTemplateParams) {
    this.messages = messages;
    this.schema = schema;
    this.templateFiller =
      templateFiller ||
      ((content: string, args: object) => fillTemplate(content, args, templateEngine)) as TemplateFiller;
    this.validator = validator || validate;
    this.tracer = new Tracer(this.getTraceName());
    this.onPromptTemplateStart = onPromptTemplateStart;
    this.onPromptTemplateEnd = onPromptTemplateEnd;
    this.onPromptTemplateError = onPromptTemplateError;
  }

  call({ args }: PromptTemplateCallParams) {
    if (this.schema) {
      this.validate(args, this.schema);
    }

    this.onStart({ args });
    const messages = this.messages.map((message) => ({
      role: message.role,
      content: this.templateFiller(message.content, args),
    }));
    this.onEnd({ messages });

    return messages;
  }

  validate(instance: object, schema: object) {
    const validatorResult = this.validator(instance, schema, { required: true });
    this.tracer.push({
      type: 'validate-prompt-args',
      args: instance,
      schema: this.schema,
      result: validatorResult,
    });
    logger.debug('validating prompt args');
    logger.debug('instance:', instance);
    logger.debug('schema:', schema);
    logger.debug('result:', validatorResult.valid ? 'valid' : validatorResult.errors);
    if (!validatorResult.valid) {
      this.throwSchemaError(validatorResult);
    }
  }

  getTraceName() {
    return ['prompt-template', new Date().toISOString()].join(' - ');
  }

  onStart({ args }: PromptTemplateCallParams) {
    logger.info('start filling template');
    this.startTime = new Date();
    this.tracer.push({
      type: 'call-prompt-template',
      messages: this.messages,
      args,
      startTime: this.startTime.getTime(),
    });
    if (this.onPromptTemplateStart) {
      this.onPromptTemplateStart({
        messageTemplates: this.messages,
        args,
        trace: this.tracer.currentTrace(),
      });
    }
  }

  onEnd({ messages }: OnPromptTemplateEndParams) {
    logger.info('end filling template');
    const endTime = new Date();
    this.tracer
      .addProperty('messages', messages)
      .addProperty('endTime', endTime.getTime())
      .addProperty('elapsedMillis', endTime.getTime() - this.startTime.getTime())
      .addProperty('elapsedReadable', dayjs(endTime).from(this.startTime))
      .addProperty('success', true);
    if (this.onPromptTemplateEnd) {
      this.onPromptTemplateEnd({
        messages,
        trace: this.tracer.currentTrace(),
      });
    }
  }

  throwSchemaError(validatorResult: ValidatorResult) {
    this.tracer.push({
      type: 'error',
      errors: validatorResult.errors,
    });
    if (this.onPromptTemplateError) {
      this.onPromptTemplateError(validatorResult.errors);
    }
    throw new SchemaError(validatorResult);
  }

}
