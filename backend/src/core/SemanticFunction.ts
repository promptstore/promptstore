import { default as dayjs } from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { ValidatorResult, validate } from 'jsonschema';

import logger from '../logger';

import { Validator } from './common_types';
import { SchemaError, SemanticFunctionError } from './errors';
import { Callback } from './Callback';
import {
  SemanticFunctionParams,
  SemanticFunctionCallParams,
  SemanticFunctionOnEndParams,
} from './SemanticFunction_types';
import { SemanticFunctionImplementation } from './SemanticFunctionImplementation';
// import { Tracer } from './Tracer';

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
  validator: Validator;
  callbacks: Callback[];
  currentCallbacks: Callback[];
  // tracer: Tracer;
  // startTime: Date;

  constructor({
    name,
    argsSchema,
    implementations,
    validator,
    callbacks,
  }: SemanticFunctionParams) {
    this.name = name;
    this.argsSchema = argsSchema;
    this.implementations = implementations;
    this.validator = validator || validate;
    this.callbacks = callbacks || [];
    // this.tracer = new Tracer(this.getTraceName());
  }

  async call({
    args,
    history,
    modelKey,
    modelParams,
    isBatch,
    callbacks = []
  }: SemanticFunctionCallParams) {
    this.currentCallbacks = [...this.callbacks, ...callbacks];
    this.onStart({ args, history, modelKey, modelParams, isBatch });
    try {
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
      // impl.tracer = this.tracer;
      const response = await impl.call({
        args,
        history,
        modelKey,
        modelParams,
        isBatch,
        callbacks,
      });
      this.onEnd({ response });
      return response;
    } catch (err) {
      const errors = err.errors || [{ message: String(err) }];
      this.onEnd({ errors });
      throw err;
    }
  }

  getImplementation(modelKey: string) {
    // logger.debug('implementations:', this.implementations);
    // logger.debug('modelKey:', modelKey);
    const finder = modelKey ?
      (impl: SemanticFunctionImplementation) => impl.model.modelKey === modelKey :
      (impl: SemanticFunctionImplementation) => impl.isDefault;
    const impl = this.implementations.find(finder) as SemanticFunctionImplementation;
    if (!impl) {
      this.throwSemanticFunctionError('implementation not found');
    }
    return impl;
  }

  // getTraceName() {
  //   return [this.name, new Date().toISOString()].join(' - ');
  // }

  onStart({ args, history, modelKey, modelParams, isBatch }: SemanticFunctionCallParams) {
    // logger.info('start function:', this.name);
    // this.startTime = new Date();
    // this.tracer.push({
    //   type: 'call-function',
    //   function: name,
    //   implementation: {
    //     model: modelKey,
    //     modelParams,
    //   },
    //   isBatch,
    //   args,
    //   history,
    //   startTime: this.startTime.getTime(),
    // });
    for (let callback of this.currentCallbacks) {
      callback.onSemanticFunctionStart({
        name: this.name,
        args,
        history,
        modelKey,
        modelParams,
        isBatch,
        // trace: this.tracer.currentTrace(),
      });
    }
    // this.tracer.down();
  }

  onEnd({ response, errors }: SemanticFunctionOnEndParams) {
    // logger.info('end function:', this.name);
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
    //     .addProperty('response', response)
    //     .addProperty('success', true)
    //     ;
    // }
    for (let callback of this.currentCallbacks) {
      callback.onSemanticFunctionEnd({
        name: this.name,
        response,
        errors,
        // traceRecord: this.tracer.close(),
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
    // this.tracer.push({
    //   type: 'validate-function-args',
    //   instance: validatorResult.instance,
    //   schema: validatorResult.schema,
    //   valid: validatorResult.valid,
    //   errors: validatorResult.errors,
    // });
    // logger.debug('validating function args');
    // logger.debug('instance:', instance);
    // logger.debug('schema:', schema);
    // logger.debug('result:', validatorResult.valid ? 'valid' : validatorResult.errors);
    for (let callback of this.currentCallbacks) {
      callback.onValidateArguments(validatorResult);
    }
    if (!validatorResult.valid) {
      this.throwSchemaError(validatorResult);
    }
  }

  throwSchemaError(validatorResult: ValidatorResult) {
    // this.tracer.push({
    //   type: 'error',
    //   errors: validatorResult.errors,
    // });
    for (let callback of this.currentCallbacks) {
      callback.onSemanticFunctionError(validatorResult.errors);
    }
    throw new SchemaError(validatorResult);
  }

  throwSemanticFunctionError(message: string) {
    const errors = [{ message }];
    // this.tracer.push({
    //   type: 'error',
    //   errors,
    // });
    for (let callback of this.currentCallbacks) {
      callback.onSemanticFunctionError(errors);
    }
    throw new SemanticFunctionError(message);
  }

}

interface SemanticFunctionOptions {
  argsSchema: any;
  callbacks: Callback[];
}

export const semanticFunction = (name: string, options: SemanticFunctionOptions) => (implementations: SemanticFunctionImplementation | SemanticFunctionImplementation[]) => {
  return new SemanticFunction({
    ...options,
    name,
    implementations: Array.isArray(implementations) ? implementations : [implementations],
  });
}
