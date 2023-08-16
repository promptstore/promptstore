import axios from 'axios';
import { default as dayjs } from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

import {
  ChatCompletionChoice,
  ChatCompletionResponse,
  CompletionResponse,
} from './common_types';
import { SemanticFunctionError } from './errors';
import { Callback } from './Callback';
import {
  Model,
  LLMChatModelParams,
  LLMCompletionModelParams,
  ModelCallParams,
  CustomModelParams,
  CustomModelCallParams,
  HuggingfaceModelParams,
  HuggingfaceModelCallParams,
  ChatCompletionService,
  CompletionService,
  ModelOnEndParams,
  CustomModelOnEndParams,
  HuggingfaceModelOnEndParams,
} from './Model_types';

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
      // return {
      //   ...response,
      //   content: response.choices[0].message.content
      // };
      return response;
    } catch (err) {
      const errors = err.errors || [{ message: String(err) }];
      this.onEnd({ errors });
      throw err;
    }
  }

  onStart({ messages, modelKey, modelParams }: ModelCallParams) {
    for (let callback of this.currentCallbacks) {
      callback.onModelStart({
        messages,
        modelKey,
        modelParams,
      });
    }
  }

  onEnd({ response, errors }: ModelOnEndParams) {
    for (let callback of this.currentCallbacks) {
      callback.onModelEnd({
        modelKey: this.modelKey,
        response,
        errors,
      });
    }
  }

}

export class LLMCompletionModel implements Model {

  modelType: string;
  modelKey: string;
  completionService: CompletionService;
  callbacks: Callback[];
  currentCallbacks: Callback[];

  constructor({
    modelType,
    modelKey,
    completionService,
    callbacks,
  }: LLMCompletionModelParams) {
    this.modelType = modelType;
    this.modelKey = modelKey;
    this.completionService = completionService;
    this.callbacks = callbacks || [];
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
      const prompt = messages.map(m => m.content);
      const completion = await this.completionService({
        provider: 'openai',
        prompt,
        model: myModelKey,
        modelParams: modelParamsWithDefaults,
      });
      const response = this.formatCompletionAsChat(completion);
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

  formatCompletionAsChat(completion: CompletionResponse): ChatCompletionResponse {
    const choices = completion.choices.map(c => ({
      index: c.index,
      finish_reason: c.finish_reason,
      message: {
        role: 'assistant',
        content: c.text,
      },
    })) as ChatCompletionChoice[];
    return {
      ...completion,
      choices,
    };
  }

  onStart({ messages, modelKey, modelParams }: ModelCallParams) {
    for (let callback of this.currentCallbacks) {
      callback.onCompletionModelStart({
        messages,
        modelKey,
        modelParams,
      });
    }
  }

  onEnd({ response, errors }: ModelOnEndParams) {
    for (let callback of this.currentCallbacks) {
      callback.onCompletionModelEnd({
        modelKey: this.modelKey,
        response,
        errors,
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
        modelKey: this.modelKey,
        url: isBatch ? this.batchEndpoint : this.url,
        args,
        isBatch,
      });
    }
  }

  onEnd({ response, errors }: CustomModelOnEndParams) {
    for (let callback of this.currentCallbacks) {
      callback.onCustomModelEnd({
        modelKey: this.modelKey,
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
  modelKey: string;
  modelProviderService: any;
  callbacks: Callback[];
  currentCallbacks: Callback[];

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

  onStart({ args }: HuggingfaceModelCallParams) {
    for (let callback of this.currentCallbacks) {
      callback.onHuggingfaceModelStart({
        modelKey: this.modelKey,
        args,
      });
    }
  }

  onEnd({ response, errors }: HuggingfaceModelOnEndParams) {
    for (let callback of this.currentCallbacks) {
      callback.onHuggingfaceModelEnd({
        modelKey: this.modelKey,
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

interface LLMCompletionModelOptions {
  modelKey: string;
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
