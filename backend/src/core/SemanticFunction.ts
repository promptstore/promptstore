import * as dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { ValidatorResult, validate } from 'jsonschema';

import logger from '../logger';

import { Validator } from './common_types';
import {
  SemanticFunctionParams,
  SemanticFunctionCallParams,
  OnSemanticFunctionStartCallbackFunction,
  OnSemanticFunctionEndCallbackFunction,
  OnSemanticFunctionErrorCallbackFunction,
  OnSemanticFunctionEndParams,
} from './SemanticFunction_types';
import { SemanticFunctionImplementation } from './SemanticFunctionImplementation';
import { Tracer } from './Tracer';
import { SchemaError, SemanticFunctionError } from './errors';

dayjs.extend(relativeTime);

/**
 * @example
 * Use with validation
 * 
 *   const ValidatingSemanticFunction = withValidation(SemanticFunction);
 *   const semfn = new ValidatingSemanticFunction(...args);
 * 
 */
export class SemanticFunction {

  name: string;
  argsSchema: object;
  implementations: SemanticFunctionImplementation[]
  tracer: Tracer;
  validator: Validator;
  onSemanticFunctionStart?: OnSemanticFunctionStartCallbackFunction;
  onSemanticFunctionEnd?: OnSemanticFunctionEndCallbackFunction;
  onSemanticFunctionError?: OnSemanticFunctionErrorCallbackFunction;
  startTime: Date;

  constructor({
    name,
    argsSchema,
    implementations,
    validator,
    onSemanticFunctionStart,
    onSemanticFunctionEnd,
    onSemanticFunctionError,
  }: SemanticFunctionParams) {
    this.name = name;
    this.argsSchema = argsSchema;
    this.implementations = implementations;
    this.validator = validator || validate;
    this.tracer = new Tracer(this.getTraceName());
    this.onSemanticFunctionStart = onSemanticFunctionStart;
    this.onSemanticFunctionEnd = onSemanticFunctionEnd;
    this.onSemanticFunctionError = onSemanticFunctionError;
  }

  async call({
    args,
    modelKey,
    modelParams,
    isBatch,
  }: SemanticFunctionCallParams) {
    let instance: object;
    if (isBatch) {
      this.assertBatch(args);
      instance = args[0];
    } else {
      instance = args;
    }
    if (this.argsSchema) {
      this.validate(instance, this.argsSchema);
    }
    const impl = this.getImplementation(modelKey);

    this.onStart({ args, modelKey, modelParams, isBatch });
    const response = await impl.call({
      args,
      modelKey,
      modelParams,
      isBatch,
    });
    this.onEnd({ response });
    return response;
  }

  getImplementation(modelKey: string) {
    const finder = modelKey ?
      (impl: SemanticFunctionImplementation) => impl.model.modelKey === modelKey :
      (impl: SemanticFunctionImplementation) => impl.isDefault;
    const impl = this.implementations.find(finder) as SemanticFunctionImplementation;
    if (!impl) {
      this.throwSemanticFunctionError('implementation not found');
    }
    return impl;
  }

  getTraceName() {
    return [this.name, new Date().toISOString()].join(' - ');
  }

  onStart({ args, modelKey, modelParams, isBatch }: SemanticFunctionCallParams) {
    logger.info('start function:', this.name);
    this.startTime = new Date();
    this.tracer.push({
      type: 'call-function',
      function: {
        name: this.name,
        argsSchema: this.argsSchema,
      },
      implementation: {
        model: {
          modelKey,
          modelParams,
        },
      },
      isBatch,
      args,
      startTime: this.startTime.getTime(),
    });
    if (this.onSemanticFunctionStart) {
      this.onSemanticFunctionStart({
        args,
        modelKey,
        modelParams,
        isBatch,
        trace: this.tracer.currentTrace(),
      });
    }
  }

  onEnd({ response }: OnSemanticFunctionEndParams) {
    logger.info('end function:', this.name);
    const endTime = new Date();
    this.tracer
      .addProperty('response', response)
      .addProperty('endTime', endTime.getTime())
      .addProperty('elapsedMillis', endTime.getTime() - this.startTime.getTime())
      .addProperty('elapsedReadable', dayjs(endTime).from(this.startTime))
      .addProperty('success', true);
    if (this.onSemanticFunctionEnd) {
      this.onSemanticFunctionEnd({
        response,
        traceRecord: this.tracer.close(),
      });
    }
  }

  assertBatch(args: any) {
    if (!Array.isArray(args)) {
      this.throwSemanticFunctionError('Array input expected');
    }
  }

  validate(instance: object, schema: object) {
    const validatorResult = this.validator(instance, schema, { required: true });
    this.tracer.push({
      type: 'validate-function-args',
      args: instance,
      schema: this.argsSchema,
      result: validatorResult,
    });
    logger.debug('validating function args');
    logger.debug('instance:', instance);
    logger.debug('schema:', schema);
    logger.debug('result:', validatorResult.valid ? 'valid' : validatorResult.errors);
    if (!validatorResult.valid) {
      this.throwSchemaError(validatorResult);
    }
  }

  throwSchemaError(validatorResult: ValidatorResult) {
    this.tracer.push({
      type: 'error',
      errors: validatorResult.errors,
    });
    if (this.onSemanticFunctionError) {
      this.onSemanticFunctionError(validatorResult.errors);
    }
    throw new SchemaError(validatorResult);
  }

  throwSemanticFunctionError(message: string) {
    const errors = [{ message }];
    this.tracer.push({
      type: 'error',
      errors,
    });
    if (this.onSemanticFunctionError) {
      this.onSemanticFunctionError(errors);
    }
    throw new SemanticFunctionError(message);
  }

}
