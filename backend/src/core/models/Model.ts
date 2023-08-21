import axios from 'axios';
import relativeTime from 'dayjs/plugin/relativeTime';
import { default as dayjs } from 'dayjs';

import { Model } from '../common_types';
import { SemanticFunctionError } from '../errors';
import { Callback } from '../Callback';
import {
  CustomModelParams,
  CustomModelCallParams,
  CustomModelOnEndParams,
} from './custom_model_types';
import {
  HuggingfaceModelParams,
  HuggingfaceModelCallParams,
  HuggingfaceModelOnEndParams,
} from './huggingface_types';
import {
  CompletionService,
  LLMChatModelParams,
  ModelCallParams,
  ModelOnEndParams,
} from './llm_types';

dayjs.extend(relativeTime);

const defaultLLMChatModelParams = {
  max_tokens: 140,
  n: 1,
  temperature: 0.5,
};

export class LLMChatModel implements Model {

  modelType: string;
  model: string;
  provider: string;
  completionService: CompletionService;
  callbacks: Callback[];
  currentCallbacks: Callback[];

  constructor({
    modelType,
    model,
    provider,
    completionService,
    callbacks,
  }: LLMChatModelParams) {
    this.modelType = modelType;
    this.model = model;
    this.provider = provider;
    this.completionService = completionService;
    this.callbacks = callbacks || [];
  }

  async call({ request, callbacks = [] }: ModelCallParams) {
    this.currentCallbacks = [...this.callbacks, ...callbacks];
    const model = request.model || this.model;
    const modelParamsWithDefaults = {
      ...defaultLLMChatModelParams,
      ...request.model_params,
    };
    request = {
      ...request,
      model,
      model_params: modelParamsWithDefaults,
    };
    this.onStart({ request });
    try {
      const response = await this.completionService({ provider: this.provider, request });
      this.onEnd({ model, response });
      return response;
    } catch (err) {
      const errors = err.errors || [{ message: String(err) }];
      this.onEnd({ model, errors });
      throw err;
    }
  }

  onStart({ request }: ModelCallParams) {
    for (let callback of this.currentCallbacks) {
      callback.onModelStart({ request });
    }
  }

  onEnd(params: ModelOnEndParams) {
    for (let callback of this.currentCallbacks) {
      callback.onModelEnd(params);
    }
  }

}

export class LLMCompletionModel implements Model {

  modelType: string;
  model: string;
  provider: string;
  completionService: CompletionService;
  callbacks: Callback[];
  currentCallbacks: Callback[];

  constructor({
    modelType,
    model,
    provider,
    completionService,
    callbacks,
  }: LLMChatModelParams) {
    this.modelType = modelType;
    this.model = model;
    this.provider = provider;
    this.completionService = completionService;
    this.callbacks = callbacks || [];
  }

  async call({ request, callbacks = [] }: ModelCallParams) {
    this.currentCallbacks = [...this.callbacks, ...callbacks];
    const model = request.model || this.model;
    const modelParamsWithDefaults = {
      ...defaultLLMChatModelParams,
      ...request.model_params,
    };
    request = {
      ...request,
      model,
      model_params: modelParamsWithDefaults,
    };
    this.onStart({ request });
    try {
      const response = await this.completionService({ provider: this.provider, request });
      this.onEnd({ model, response });
      return response;
    } catch (err) {
      const errors = err.errors || [{ message: String(err) }];
      this.onEnd({ model, errors });
      throw err;
    }
  }

  onStart({ request }: ModelCallParams) {
    for (let callback of this.currentCallbacks) {
      callback.onCompletionModelStart({ request });
    }
  }

  onEnd(params: ModelOnEndParams) {
    for (let callback of this.currentCallbacks) {
      callback.onCompletionModelEnd(params);
    }
  }

}

export class CustomModel implements Model {

  modelType: string;
  model: string;
  url: string;
  batchEndpoint: string;
  callbacks: Callback[];
  currentCallbacks: Callback[];

  constructor({
    modelType,
    model,
    url,
    batchEndpoint,
    callbacks,
  }: CustomModelParams) {
    this.modelType = modelType;
    this.model = model;
    this.url = url;
    this.batchEndpoint = batchEndpoint;
    this.callbacks = callbacks || [];
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

  onStart({ args, isBatch }: CustomModelCallParams) {
    for (let callback of this.currentCallbacks) {
      callback.onCustomModelStart({
        model: this.model,
        url: isBatch ? this.batchEndpoint : this.url,
        args,
        isBatch,
      });
    }
  }

  onEnd({ response, errors }: CustomModelOnEndParams) {
    for (let callback of this.currentCallbacks) {
      callback.onCustomModelEnd({
        model: this.model,
        response,
        errors,
      });
    }
  }

  throwSemanticFunctionError(message: string) {
    const errors = [{ message }];
    for (let callback of this.currentCallbacks) {
      callback.onCustomModelError(errors);
    }
    throw new SemanticFunctionError(message);
  }

}

export class HuggingfaceModel implements Model {

  modelType: string;
  model: string;
  modelProviderService: any;
  callbacks: Callback[];
  currentCallbacks: Callback[];

  constructor({
    modelType,
    model,
    modelProviderService,
    callbacks,
  }: HuggingfaceModelParams) {
    this.modelType = modelType;
    this.model = model;
    this.modelProviderService = modelProviderService;
    this.callbacks = callbacks || [];
  }

  async call({ args, callbacks = [] }: HuggingfaceModelCallParams) {
    this.currentCallbacks = [...this.callbacks, ...callbacks];
    this.onStart({ args });
    try {
      const response = await this.modelProviderService.query('huggingface', this.model, args);
      this.onEnd({ response });
      return response;
    } catch (err) {
      const errors = err.errors || [{ message: String(err) }];
      this.onEnd({ errors });
      throw err;
    }
  }

  onStart({ args }: HuggingfaceModelCallParams) {
    for (let callback of this.currentCallbacks) {
      callback.onHuggingfaceModelStart({
        model: this.model,
        args,
      });
    }
  }

  onEnd({ response, errors }: HuggingfaceModelOnEndParams) {
    for (let callback of this.currentCallbacks) {
      callback.onHuggingfaceModelEnd({
        model: this.model,
        response,
        errors,
      });
    }
  }

  throwSemanticFunctionError(message: string) {
    const errors = [{ message }];
    for (let callback of this.currentCallbacks) {
      callback.onHuggingfaceModelError(errors);
    }
    throw new SemanticFunctionError(message);
  }

}

interface LLMModelOptions {
  model: string;
  provider: string;
  completionService: CompletionService;
  callbacks: Callback[];
}

export const llmModel = (options: LLMModelOptions) => {
  return new LLMChatModel({
    ...options,
    modelType: 'gpt',
  });
}

interface LLMCompletionModelOptions {
  model: string;
  provider: string;
  completionService: CompletionService;
  callbacks: Callback[];
}

export const completionModel = (options: LLMCompletionModelOptions) => {
  return new LLMCompletionModel({
    ...options,
    modelType: 'completion',
  });
}

interface CustomModelOptions {
  model: string;
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
  model: string;
  modelProviderService: any;
  callbacks: Callback[];
}

export const huggingfaceModel = (options: HuggingfaceModelOptions) => {
  return new HuggingfaceModel({
    ...options,
    modelType: 'huggingface',
  });
}