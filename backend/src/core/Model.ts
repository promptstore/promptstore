import axios from 'axios';
import { default as dayjs } from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

import logger from '../logger';

import { SemanticFunctionError } from './errors';
import { Callback } from './Callback';

import {
  Model,
  LLMChatModelParams,
  ModelCallParams,
  CustomModelParams,
  CustomModelCallParams,
  HuggingfaceModelParams,
  HuggingfaceModelCallParams,
  ChatCompletionService,
  ModelOnEndParams,
  CustomModelOnEndParams,
  HuggingfaceModelOnEndParams,
} from './Model_types';
// import { Tracer } from './Tracer';

dayjs.extend(relativeTime);

const defaultLLMChatModelParams = {
  max_tokens: 140,
  n: 1,
  temperature: 0.5,
};

export class LLMChatModel implements Model {

  modelType: string;
  modelKey: string;
  chatCompletionService: ChatCompletionService;
  callbacks: Callback[];
  currentCallbacks: Callback[];
  // tracer: Tracer;
  // startTime: Date;

  constructor({
    modelType,
    modelKey,
    chatCompletionService,
    callbacks,
  }: LLMChatModelParams) {
    this.modelType = modelType;
    this.modelKey = modelKey;
    this.chatCompletionService = chatCompletionService;
    this.callbacks = callbacks || [];
    // this.tracer = new Tracer(this.getTraceName());
  }

  async call({ messages, modelKey, modelParams, callbacks = [] }: ModelCallParams) {
    this.currentCallbacks = [...this.callbacks, ...callbacks];
    const myModelKey = modelKey || this.modelKey;
    const modelParamsWithDefaults = {
      ...defaultLLMChatModelParams,
      ...modelParams
    };
    this.onStart({ messages, modelKey: myModelKey, modelParams: modelParamsWithDefaults });
    try {
      const response = await this.chatCompletionService({
        provider: 'openai',
        messages,
        model: myModelKey,
        modelParams: modelParamsWithDefaults,
      });
      this.onEnd({ response });
      return {
        ...response,
        content: response.choices[0].message.content
      };
    } catch (err) {
      const errors = err.errors || [{ message: String(err) }];
      this.onEnd({ errors });
      throw err;
    }
  }

  getTraceName() {
    return [this.modelKey, new Date().toISOString()].join(' - ');
  }

  onStart({ messages, modelKey, modelParams }: ModelCallParams) {
    // logger.info('start model:', modelKey);
    // this.startTime = new Date();
    // this.tracer.push({
    //   type: 'call-model',
    //   model: modelKey,
    //   modelParams,
    //   messages,
    //   startTime: this.startTime.getTime(),
    // });
    for (let callback of this.currentCallbacks) {
      callback.onModelStart({
        messages,
        modelKey,
        modelParams,
        // trace: this.tracer.currentTrace(),
      });
    }
    // this.tracer.down();
  }

  onEnd({ response, errors }: ModelOnEndParams) {
    // logger.info('end model:', this.modelKey);
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
      callback.onModelEnd({
        modelKey: this.modelKey,
        response,
        errors,
        // trace: this.tracer.currentTrace(),
      });
    }
  }

}

export class CustomModel implements Model {

  modelType: string;
  modelKey: string;
  url: string;
  batchEndpoint: string;
  callbacks: Callback[];
  currentCallbacks: Callback[];
  // tracer: Tracer;
  // startTime: Date;

  constructor({
    modelType,
    modelKey,
    url,
    batchEndpoint,
    callbacks,
  }: CustomModelParams) {
    this.modelType = modelType;
    this.modelKey = modelKey;
    this.url = url;
    this.batchEndpoint = batchEndpoint;
    this.callbacks = callbacks || [];
    // this.tracer = new Tracer(this.getTraceName());
  }

  async call({ args, isBatch, callbacks = [] }: CustomModelCallParams) {
    this.currentCallbacks = [...this.callbacks, ...callbacks];
    this.onStart({ args, isBatch });
    try {
      let res: any;
      if (isBatch) {
        if (!this.batchEndpoint) {
          this.throwSemanticFunctionError('batch endpoint not supported');
        }
        res = await axios.post(this.batchEndpoint, args);
      } else {
        res = await axios.post(this.url, args);

      }
      const response = res.data;
      this.onEnd({ response });
      return response;
    } catch (err) {
      const errors = err.errors || [{ message: String(err) }];
      this.onEnd({ errors });
      throw err;
    }
  }

  getTraceName() {
    return [this.modelKey, new Date().toISOString()].join(' - ');
  }

  onStart({ args, isBatch }: CustomModelCallParams) {
    // logger.info('start custom model:', this.modelKey);
    // this.startTime = new Date();
    // this.tracer.push({
    //   type: 'call-custom-model',
    //   model: this.modelKey,
    //   url: isBatch ? this.batchEndpoint : this.url,
    //   args,
    //   isBatch,
    //   startTime: this.startTime.getTime(),
    // });
    for (let callback of this.currentCallbacks) {
      callback.onCustomModelStart({
        modelKey: this.modelKey,
        url: isBatch ? this.batchEndpoint : this.url,
        args,
        isBatch,
        // trace: this.tracer.currentTrace(),
      });
    }
    // this.tracer.down();
  }

  onEnd({ response, errors }: CustomModelOnEndParams) {
    // logger.info('end custom model:', this.modelKey);
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
      callback.onCustomModelEnd({
        modelKey: this.modelKey,
        response,
        errors,
        // trace: this.tracer.currentTrace(),
      });
    }
  }

  throwSemanticFunctionError(message: string) {
    const errors = [{ message }];
    // this.tracer.push({
    //   type: 'error',
    //   errors,
    // });
    for (let callback of this.currentCallbacks) {
      callback.onCustomModelError(errors);
    }
    throw new SemanticFunctionError(message);
  }

}

export class HuggingfaceModel implements Model {

  modelType: string;
  modelKey: string;
  modelProviderService: any;
  callbacks: Callback[];
  currentCallbacks: Callback[];
  // tracer: Tracer;
  // startTime: Date;

  constructor({
    modelType,
    modelKey,
    modelProviderService,
    callbacks,
  }: HuggingfaceModelParams) {
    this.modelType = modelType;
    this.modelKey = modelKey;
    this.modelProviderService = modelProviderService;
    this.callbacks = callbacks || [];
    // this.tracer = new Tracer(this.getTraceName());
  }

  async call({ args, callbacks = [] }: HuggingfaceModelCallParams) {
    this.currentCallbacks = [...this.callbacks, ...callbacks];
    this.onStart({ args });
    try {
      const response = await this.modelProviderService.query('huggingface', this.modelKey, args);
      this.onEnd({ response });
      return response;
    } catch (err) {
      const errors = err.errors || [{ message: String(err) }];
      this.onEnd({ errors });
      throw err;
    }
  }

  getTraceName() {
    return [this.modelKey, new Date().toISOString()].join(' - ');
  }

  onStart({ args }: HuggingfaceModelCallParams) {
    // logger.info('start huggingface model:', this.modelKey);
    // this.startTime = new Date();
    // this.tracer.push({
    //   type: 'call-huggingface-model',
    //   model: this.modelKey,
    //   args,
    //   startTime: this.startTime.getTime(),
    // });
    for (let callback of this.currentCallbacks) {
      callback.onHuggingfaceModelStart({
        modelKey: this.modelKey,
        args,
        // trace: this.tracer.currentTrace(),
      });
    }
    // this.tracer.down();
  }

  onEnd({ response, errors }: HuggingfaceModelOnEndParams) {
    // logger.info('end huggingface model:', this.modelKey);
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
      callback.onHuggingfaceModelEnd({
        modelKey: this.modelKey,
        response,
        errors,
        // trace: this.tracer.currentTrace(),
      });
    }
  }

  throwSemanticFunctionError(message: string) {
    const errors = [{ message }];
    // this.tracer.push({
    //   type: 'error',
    //   errors,
    // });
    for (let callback of this.currentCallbacks) {
      callback.onHuggingfaceModelError(errors);
    }
    throw new SemanticFunctionError(message);
  }

}

interface LLMModelOptions {
  modelKey: string;
  chatCompletionService: ChatCompletionService;
  callbacks: Callback[];
}

export const llmModel = (options: LLMModelOptions) => {
  return new LLMChatModel({
    ...options,
    modelType: 'gpt',
  });
}

interface CustomModelOptions {
  modelKey: string;
  url?: string;
  batchEndpoint?: string;
  callbacks: Callback[];
}

export const customModel = (options: CustomModelOptions) => {
  return new CustomModel({
    ...options,
    modelType: 'api',
  });
}

interface HuggingfaceModelOptions {
  modelKey: string;
  modelProviderService: any;
  callbacks: Callback[];
}

export const huggingfaceModel = (options: HuggingfaceModelOptions) => {
  return new HuggingfaceModel({
    ...options,
    modelType: 'huggingface',
  });
}
