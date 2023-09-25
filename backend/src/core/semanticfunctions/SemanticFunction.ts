import isEmpty from 'lodash.isempty';
import relativeTime from 'dayjs/plugin/relativeTime';
import { default as dayjs } from 'dayjs';
import { ValidatorResult, validate } from 'jsonschema';

import { Validator } from '../common_types';
import { SchemaError, SemanticFunctionError } from '../errors';
import { Callback } from '../callbacks/Callback';
import {
  Experiment,
  SemanticFunctionParams,
  SemanticFunctionCallParams,
  SemanticFunctionOnEndParams,
} from './SemanticFunction_types';
import { SemanticFunctionImplementation } from './SemanticFunctionImplementation';

dayjs.extend(relativeTime);

export class SemanticFunction {

  name: string;
  argsSchema: object;
  experiments?: Experiment[];
  implementations: SemanticFunctionImplementation[]
  validator: Validator;
  callbacks: Callback[];
  currentCallbacks: Callback[];

  constructor({
    name,
    argsSchema,
    experiments,
    implementations,
    validator,
    callbacks,
  }: SemanticFunctionParams) {
    this.name = name;
    this.argsSchema = argsSchema;
    this.experiments = experiments;
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
      if (isEmpty(this.implementations)) {
        this.throwSemanticFunctionError('no implementations');
      }

      // validate args
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

      // get implementation
      const impl = this.getImplementation(modelKey);
      if (!impl) {
        this.throwSemanticFunctionError('implementation not found. check if `modelKey` is correct: ' + modelKey);
      }

      // call implementation
      const { response, responseMetadata } = await impl.call({
        args,
        history,
        modelKey,
        modelParams,
        isBatch,
        callbacks,
      });

      this.onEnd({ response, implementation: impl.model.model });
      return { response, responseMetadata };

    } catch (err) {
      const errors = err.errors || [{ message: String(err) }];
      this.onEnd({ errors });
      throw err;
    }
  }

  // https://stackoverflow.com/questions/44915948/a-better-way-to-do-random-sampling-with-a-probability-distribution
  getImplementationFromExperiment() {
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
    for (let callback of this.currentCallbacks) {
      callback.onExperiment({ experiments, implementation });
    }

    return impl;
  }

  getImplementation(modelKey?: string) {
    let impl: SemanticFunctionImplementation;
    if (modelKey) {
      impl = this.implementations.find((impl: SemanticFunctionImplementation) => impl.model.model === modelKey);
    } else if (this.experiments) {
      impl = this.getImplementationFromExperiment();
    } else {
      impl = this.implementations.find((impl: SemanticFunctionImplementation) => impl.isDefault);
      if (!impl) {
        impl = this.implementations[0];
      }
    }
    return impl;
  }

  // getImplementation(modelKey: string) {
  //   const finder = modelKey ?
  //     (impl: SemanticFunctionImplementation) => impl.model.model === modelKey :
  //     (impl: SemanticFunctionImplementation) => impl.isDefault;
  //   let impl = this.implementations.find(finder) as SemanticFunctionImplementation;
  //   if (!impl && this.implementations) {
  //     impl = this.implementations[0];
  //   }
  //   if (!impl) {
  //     this.throwSemanticFunctionError('implementation not found');
  //   }
  //   return impl;
  // }

  onStart({ args, history, modelKey, modelParams, isBatch }: SemanticFunctionCallParams) {
    for (let callback of this.currentCallbacks) {
      callback.onSemanticFunctionStart({
        name: this.name,
        args,
        history,
        experiments: this.experiments,
        modelKey,
        modelParams,
        isBatch,
      });
    }
  }

  onEnd({ response, errors, implementation }: SemanticFunctionOnEndParams) {
    for (let callback of this.currentCallbacks) {
      callback.onSemanticFunctionEnd({
        name: this.name,
        response,
        errors,
        implementation,
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
  experiments: Experiment[];
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
