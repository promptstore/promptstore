import isEmpty from 'lodash.isempty';
import relativeTime from 'dayjs/plugin/relativeTime';
import { default as dayjs } from 'dayjs';
import { ValidatorResult, validate } from 'jsonschema';

import logger from '../../logger';

import { Validator } from '../common_types';
import { SchemaError, SemanticFunctionError } from '../errors';
import { Callback } from '../callbacks/Callback';
import { convertContentTypeToString } from '../conversions/RosettaStone';
import { convertResponseWithImages } from '../utils';
import {
  Experiment,
  SemanticFunctionParams,
  SemanticFunctionCallParams,
  SemanticFunctionOnEndParams,
} from './SemanticFunction_types';
import { SemanticFunctionImplementation } from './SemanticFunctionImplementation';

dayjs.extend(relativeTime);

export class SemanticFunction {

  id: number;
  name: string;
  description: string;
  argsSchema: object;
  returnType: string;
  returnTypeSchema?: object;
  experiments?: Experiment[];
  implementations: SemanticFunctionImplementation[]
  validator: Validator;
  callbacks: Callback[];

  constructor({
    id,
    name,
    description,
    argsSchema,
    returnType,
    returnTypeSchema,
    experiments,
    implementations,
    validator,
    callbacks,
  }: SemanticFunctionParams) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.argsSchema = argsSchema;
    this.returnType = returnType;
    this.returnTypeSchema = returnTypeSchema;
    this.experiments = experiments;
    this.implementations = implementations;
    this.validator = validator || validate;
    this.callbacks = callbacks || [];
  }

  async call({
    args,
    messages,
    history,
    extraSystemPrompt,
    model,
    modelParams,
    functions,
    isBatch,
    options,
    callbacks,
  }: SemanticFunctionCallParams) {
    let _callbacks: Callback[];
    if (callbacks?.length) {
      _callbacks = callbacks;
    } else {
      _callbacks = this.callbacks;
    }
    this.onStart({ args, history, model, modelParams, isBatch }, _callbacks);
    try {
      if (isEmpty(this.implementations)) {
        this.throwSemanticFunctionError('no implementations', _callbacks);
      }

      // validate args
      // let instance: object;
      // if (Array.isArray(args)) {
      //   instance = args[0];
      // } else {
      //   instance = args;
      // }
      if (this.argsSchema) {
        // this.validate(instance, this.argsSchema);
        this.validate(args, this.argsSchema, _callbacks);
      }

      // get implementation
      const impl = this.getImplementation(_callbacks, model?.model);
      if (!impl) {
        this.throwSemanticFunctionError('implementation not found.', _callbacks);
      }

      // call implementation
      let { response, responseMetadata } = await impl.call({
        args,
        messages,
        history,
        extraSystemPrompt,
        model,
        modelParams,
        functions,
        isBatch,
        returnTypeSchema: this.returnTypeSchema,
        options,
        callbacks: _callbacks,
      });
      const message = response.choices[0].message;
      let systemOutputText: string;
      if (!message.function_call) {
        systemOutputText = convertContentTypeToString(message.content);
      }

      responseMetadata = {
        ...responseMetadata,
        implementation: impl.model.model,
        systemInput: { args, messages, history, extraSystemPrompt },
        systemOutput: message,  // could be content or function call
        systemOutputText,
        functionId: this.id,
        functionName: this.name,
      };
      this.onEnd({
        response: await convertResponseWithImages(response),
        responseMetadata,
      }, _callbacks);

      return { response, responseMetadata };

    } catch (err) {
      const errors = err.errors || [{ message: String(err) }];
      this.onEnd({ errors }, _callbacks);
      throw err;
    }
  }

  // https://stackoverflow.com/questions/44915948/a-better-way-to-do-random-sampling-with-a-probability-distribution
  getImplementationFromExperiment(callbacks: Callback[]) {
    // sample using probability distribution
    const sum = this.experiments.reduce((a: number, { percentage }: Experiment) => a + percentage, 0);
    let sample = Math.random() * sum;
    const index = this.experiments.findIndex(({ percentage }: Experiment) => (sample -= percentage) < 0);

    // notify callbacks
    const experiments = this.experiments.map((xp, i) => ({
      ...xp,
      implementation: this.implementations[i].model.model,
    }));
    const impl = this.implementations[index];
    const implementation = impl.model.model;
    for (let callback of callbacks) {
      callback.onExperiment({ experiments, implementation });
    }

    return impl;
  }

  getImplementation(callbacks: Callback[], model?: string) {
    let impl: SemanticFunctionImplementation;
    if (model) {
      impl = this.implementations.find(impl => impl.model.model === model);
      if (impl) return impl;
    }
    if (this.experiments) {
      return this.getImplementationFromExperiment(callbacks);
    }
    impl = this.implementations.find(impl => impl.isDefault);
    if (!impl) {
      impl = this.implementations[0];
    }
    return impl;
  }

  onStart({ args, history, model, modelParams, isBatch }: SemanticFunctionCallParams, callbacks: Callback[]) {
    for (let callback of callbacks) {
      callback.onSemanticFunctionStart({
        name: this.name,
        args,
        history,
        experiments: this.experiments,
        model,
        modelParams,
        isBatch,
      });
    }
  }

  onEnd({ errors, response, responseMetadata }: Partial<SemanticFunctionOnEndParams>, callbacks: Callback[]) {
    for (let callback of callbacks) {
      callback.onSemanticFunctionEnd({
        name: this.name,
        response,
        responseMetadata,
        errors,
      });
    }
  }

  assertBatch(args: any, callbacks: Callback[]) {
    if (!Array.isArray(args)) {
      this.throwSemanticFunctionError('Array input expected', callbacks);
    }
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

  throwSchemaError(validatorResult: ValidatorResult, callbacks: Callback[]) {
    for (let callback of callbacks) {
      callback.onSemanticFunctionError(validatorResult.errors);
    }
    throw new SchemaError(validatorResult);
  }

  throwSemanticFunctionError(message: string, callbacks: Callback[]) {
    const errors = [{ message }];
    for (let callback of callbacks) {
      callback.onSemanticFunctionError(errors);
    }
    throw new SemanticFunctionError(message);
  }

}

interface SemanticFunctionOptions {
  argsSchema?: object;
  returnType: string;
  returnTypeSchema?: object;
  experiments: Experiment[];
  callbacks: Callback[];
}

export const semanticFunction = (id: number, name: string, description: string, options: SemanticFunctionOptions) => (
  implementations: SemanticFunctionImplementation | SemanticFunctionImplementation[]
) => {
  return new SemanticFunction({
    ...options,
    id,
    name,
    description,
    implementations: Array.isArray(implementations) ? implementations : [implementations],
  });
}
