import isEmpty from 'lodash.isempty';
import relativeTime from 'dayjs/plugin/relativeTime';
import { default as dayjs } from 'dayjs';
import { ValidatorResult, validate } from 'jsonschema';

import logger from '../../logger';

import { Validator } from '../common_types';
import { SchemaError, SemanticFunctionError } from '../errors';
import { Callback } from '../callbacks/Callback';
import { convertContentTypeToString } from '../conversions/RosettaStone';
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
  currentCallbacks: Callback[];

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
    modelKey,
    modelParams,
    functions,
    isBatch,
    options,
    callbacks = []
  }: SemanticFunctionCallParams) {
    this.currentCallbacks = [...this.callbacks, ...callbacks];
    this.onStart({ args, history, modelKey, modelParams, isBatch });
    try {
      if (isEmpty(this.implementations)) {
        this.throwSemanticFunctionError('no implementations');
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
        this.validate(args, this.argsSchema);
      }

      // get implementation
      const impl = this.getImplementation(modelKey);
      if (!impl) {
        this.throwSemanticFunctionError('implementation not found. check if `modelKey` is correct: ' + modelKey);
      }

      // call implementation
      let { response, responseMetadata } = await impl.call({
        args,
        messages,
        history,
        extraSystemPrompt,
        modelKey,
        modelParams,
        functions,
        isBatch,
        returnTypeSchema: this.returnTypeSchema,
        options,
        callbacks,
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
      this.onEnd({ response, responseMetadata });

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

  onEnd({ errors, response, responseMetadata }: Partial<SemanticFunctionOnEndParams>) {
    for (let callback of this.currentCallbacks) {
      callback.onSemanticFunctionEnd({
        name: this.name,
        response,
        responseMetadata,
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
