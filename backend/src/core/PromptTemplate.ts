import { ValidatorResult, validate } from 'jsonschema';
import { default as dayjs } from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

import logger from '../logger';
import { fillTemplate } from '../utils';

import { Validator } from './common_types';
import { SchemaError } from './errors';
import { Callback } from './Callback';
import {
  PromptTemplateParams,
  PromptTemplateCallParams,
  IMessage,
  Message,
  TemplateFiller,
  OnPromptTemplateEndParams,
} from './PromptTemplate_types';
// import { Tracer } from './Tracer';

dayjs.extend(relativeTime);

export function message(params: any) {
  return new Message(params);
}

export class PromptTemplate {

  messages: IMessage[];
  schema?: object;
  templateFiller?: TemplateFiller;
  validator?: Validator;
  callbacks: Callback[];
  currentCallbacks: Callback[];
  // tracer: Tracer;
  // startTime: Date;

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
      ((content: string, args: object) => fillTemplate(content, args, templateEngine)) as TemplateFiller;
    this.validator = validator || validate;
    this.callbacks = callbacks || [];
    // this.tracer = new Tracer(this.getTraceName());
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
    // this.tracer.push({
    //   type: 'validate-prompt-args',
    //   instance: validatorResult.instance,
    //   schema: validatorResult.schema,
    //   valid: validatorResult.valid,
    //   errors: validatorResult.errors,
    // });
    for (let callback of this.currentCallbacks) {
      callback.onValidateArguments(validatorResult);
    }
    // logger.debug('validating prompt args');
    // logger.debug('instance:', instance);
    // logger.debug('schema:', schema);
    // logger.debug('result:', validatorResult.valid ? 'valid' : validatorResult.errors);
    if (!validatorResult.valid) {
      this.throwSchemaError(validatorResult);
    }
  }

  getTraceName() {
    return ['prompt-template', new Date().toISOString()].join(' - ');
  }

  onStart({ args }: PromptTemplateCallParams) {
    // logger.info('start filling template');
    // this.startTime = new Date();
    // this.tracer.push({
    //   type: 'call-prompt-template',
    //   messages: this.messages,
    //   args,
    //   startTime: this.startTime.getTime(),
    // });
    for (let callback of this.currentCallbacks) {
      callback.onPromptTemplateStart({
        messageTemplates: this.messages,
        args,
        // trace: this.tracer.currentTrace(),
      });
    }
    // this.tracer.down();
  }

  onEnd({ messages, errors }: OnPromptTemplateEndParams) {
    // logger.info('end filling template');
    // const endTime = new Date();
    // this.tracer
    //   .up()
    //   .addProperty('endTime', endTime.getTime())
    //   .addProperty('elapsedMillis', endTime.getTime() - this.startTime.getTime())
    //   .addProperty('elapsedReadable', dayjs(endTime).from(this.startTime))
    //   ;
    // if (errors) {
    //   this.tracer
    //     .addProperty('errors', errors)
    //     .addProperty('success', false)
    //     ;
    // } else {
    //   this.tracer
    //     .addProperty('messages', messages)
    //     .addProperty('success', true)
    //     ;
    // }
    for (let callback of this.currentCallbacks) {
      callback.onPromptTemplateEnd({
        messages,
        errors,
        // trace: this.tracer.currentTrace(),
      });
    }
  }

  throwSchemaError(validatorResult: ValidatorResult) {
    // this.tracer.push({
    //   type: 'error',
    //   errors: validatorResult.errors,
    // });
    for (let callback of this.currentCallbacks) {
      callback.onPromptTemplateError(validatorResult.errors);
    }
    throw new SchemaError(validatorResult);
  }

}

interface PromptTemplateOptions {
  schema?: object;
  templateEngine?: string;
  callbacks?: Callback[];
}

export const promptTemplate = (options: PromptTemplateOptions) => (messages: IMessage[]) => {
  return new PromptTemplate({
    ...options,
    messages,
  });
}
