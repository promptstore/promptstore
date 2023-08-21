import { default as dayjs } from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { ValidatorResult, validate } from 'jsonschema';

import { Validator } from './common_types';
import { SchemaError, SemanticFunctionError } from './errors';
import { Callback } from './Callback';
import {
  SemanticFunctionParams,
  SemanticFunctionCallParams,
  SemanticFunctionOnEndParams,
} from './SemanticFunction_types';
import { SemanticFunctionImplementation } from './SemanticFunctionImplementation';

dayjs.extend(relativeTime);

export class SemanticFunction {

  name: string;
  argsSchema: object;
  implementations: SemanticFunctionImplementation[]
  validator: Validator;
  callbacks: Callback[];
  currentCallbacks: Callback[];

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
      const { response, responseMetadata } = await impl.call({
        args,
        history,
        modelKey,
        modelParams,
        isBatch,
        callbacks,
      });
      this.onEnd({ response });
      return { response, responseMetadata };
    } catch (err) {
      const errors = err.errors || [{ message: String(err) }];
      this.onEnd({ errors });
      throw err;
    }
  }

  getImplementation(modelKey: string) {
    const finder = modelKey ?
      (impl: SemanticFunctionImplementation) => impl.model.model === modelKey :
      (impl: SemanticFunctionImplementation) => impl.isDefault;
    let impl = this.implementations.find(finder) as SemanticFunctionImplementation;
    if (!impl && this.implementations) {
      impl = this.implementations[0];
    }
    if (!impl) {
      this.throwSemanticFunctionError('implementation not found');
    }
    return impl;
  }

  onStart({ args, history, modelKey, modelParams, isBatch }: SemanticFunctionCallParams) {
    for (let callback of this.currentCallbacks) {
      callback.onSemanticFunctionStart({
        name: this.name,
        args,
        history,
        modelKey,
        modelParams,
        isBatch,
      });
    }
  }

  onEnd({ response, errors }: SemanticFunctionOnEndParams) {
    for (let callback of this.currentCallbacks) {
      callback.onSemanticFunctionEnd({
        name: this.name,
        response,
        errors,
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
    for (let callback of this.currentCallbacks) {
      callback.onValidateArguments(validatorResult);
    }
    if (!validatorResult.valid) {
      this.throwSchemaError(validatorResult);
    }
  }

  throwSchemaError(validatorResult: ValidatorResult) {
    for (let callback of this.currentCallbacks) {
      callback.onSemanticFunctionError(validatorResult.errors);
    }
    throw new SchemaError(validatorResult);
  }

  throwSemanticFunctionError(message: string) {
    const errors = [{ message }];
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

export const semanticFunction = (name: string, options: SemanticFunctionOptions) => (
  implementations: SemanticFunctionImplementation | SemanticFunctionImplementation[]
) => {
  return new SemanticFunction({
    ...options,
    name,
    implementations: Array.isArray(implementations) ? implementations : [implementations],
  });
}
