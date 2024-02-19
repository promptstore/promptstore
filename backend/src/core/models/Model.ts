import axios from 'axios';
import relativeTime from 'dayjs/plugin/relativeTime';
import uuid from 'uuid';
import { default as dayjs } from 'dayjs';

import logger from '../../logger';

import { Model } from '../common_types';
import { SemanticFunctionError } from '../errors';
import { Callback } from '../callbacks/Callback';
import {
  ChatRequest,
  ChatResponse,
  MessageRole,
  convertContentTypeToString,
  getText,
} from '../conversions/RosettaStone';
import SemanticCache from '../semanticcache/SemanticCache';
import { convertRequestWithImages, convertResponseWithImages } from '../utils';
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
  LLMModel,
  ModelCallParams,
  ModelOnEndParams,
} from './llm_types';

dayjs.extend(relativeTime);

const defaultLLMChatModelParams = {
  max_tokens: 140,
  n: 1,
  temperature: 0.5,
};

export class LLMChatModel implements LLMModel {

  modelId: number;
  modelName: string;
  modelType: string;
  model: string;
  provider: string;
  contextWindow: number;
  maxOutputTokens: number;
  completionService: CompletionService;
  semanticCache?: SemanticCache;
  semanticCacheEnabled: boolean;
  callbacks: Callback[];

  constructor({
    modelId,
    modelName,
    modelType,
    model,
    provider,
    contextWindow,
    maxOutputTokens,
    completionService,
    semanticCache,
    semanticCacheEnabled,
    callbacks,
  }: LLMChatModelParams) {
    this.modelId = modelId;
    this.modelName = modelName;
    this.modelType = modelType;
    this.model = model;
    this.provider = provider;
    this.contextWindow = contextWindow;
    this.maxOutputTokens = maxOutputTokens;
    this.completionService = completionService;
    this.semanticCache = semanticCache;
    this.semanticCacheEnabled = semanticCacheEnabled;
    this.callbacks = callbacks || [];
  }

  async call({ provider, request, callbacks }: ModelCallParams) {
    let _callbacks: Callback[];
    if (callbacks?.length) {
      _callbacks = callbacks;
    } else {
      _callbacks = this.callbacks;
    }
    let _provider: string;
    let _model: string;
    if (provider) {
      _provider = provider;
    } else {
      _provider = this.provider;
    }
    if (request.model) {
      _model = request.model;
    } else {
      _model = this.model;
    }
    let prompt: string;
    let embedding: number[];
    if (this.semanticCache && this.semanticCacheEnabled) {
      const cacheResult = await this.lookupCache(request, _callbacks);
      prompt = cacheResult.prompt;
      embedding = cacheResult.embedding;
      if (cacheResult.response) {
        return cacheResult.response;
      }
    }
    const modelParamsWithDefaults = {
      ...defaultLLMChatModelParams,
      ...request.model_params,
    };
    request = {
      ...request,
      model: _model,
      model_params: modelParamsWithDefaults,
    };
    this.onStart({
      provider: _provider,
      request: await convertRequestWithImages(request),
    }, _callbacks);
    try {
      const response = await this.completionService(this.provider, request);
      if (this.semanticCache && this.semanticCacheEnabled) {
        for (const choice of response.choices) {
          let content = choice.message.content;
          await this.semanticCache.set(prompt, convertContentTypeToString(content), embedding);
        }
      }
      let promptTokens = 0;
      let completionTokens = 0;
      let totalTokens = 0;
      if (response.usage) {
        const usage = response.usage;
        promptTokens = usage.prompt_tokens || 0;
        completionTokens = usage.completion_tokens || 0;
        totalTokens = usage.total_tokens || 0;
      }
      const message = response.choices[0].message;
      let outputType: string;
      let modelOutputText: string;
      if (message.function_call) {
        outputType = 'function_call';
      } else {
        outputType = 'content';
        modelOutputText = convertContentTypeToString(message.content);
      }

      const responseMetadata = {
        modelInput: request.prompt,
        modelUserInputText: getText(request.prompt.messages),
        outputType,
        modelOutput: message,
        modelOutputText,
        promptTokens,
        completionTokens,
        totalTokens,
      };
      this.onEnd({
        response: await convertResponseWithImages(response),
      }, _callbacks);

      return {
        response,
        responseMetadata,
      };
    } catch (err) {
      const errors = err.errors || [{ message: String(err) }];
      this.onEnd({ errors }, _callbacks);
      throw err;
    }
  }

  async lookupCache(request: ChatRequest, callbacks: Callback[]) {
    const model = request.model || this.model;
    const n = request.model_params?.n || 1;
    const messages = request.prompt.messages;
    const prompt = convertContentTypeToString(messages[messages.length - 1].content);
    const { embedding, hits } = await this.semanticCache.get(prompt, n);
    let response: ChatResponse;
    if (hits.length) {
      response = {
        id: uuid.v4(),
        created: new Date(),
        model,
        n,
        choices: hits.map((hit: any, index: number) => ({
          index,
          finish_reason: 'cache-hit',
          message: {
            role: MessageRole.assistant,
            content: hit.content,
          }
        })),
      };
    }
    console.log('lookup cache', prompt, hits.length)
    for (let callback of callbacks) {
      callback.onLookupCache({ model, prompt, hit: hits.length > 0, response });
    }
    return { prompt, embedding, response };
  }

  onStart({ provider, request }: ModelCallParams, callbacks: Callback[]) {
    let params: any = { provider, request };
    if (request.model === this.model) {
      params = {
        ...params,
        modelId: this.modelId,
        modelName: this.modelName,
      };
    }
    for (let callback of callbacks) {
      callback.onModelStart(params);
    }
  }

  onEnd(params: ModelOnEndParams, callbacks: Callback[]) {
    for (let callback of callbacks) {
      callback.onModelEnd(params);
    }
  }

}

export class LLMCompletionModel implements LLMModel {

  modelId: number;
  modelName: string;
  modelType: string;
  model: string;
  provider: string;
  contextWindow: number;
  maxOutputTokens: number;
  completionService: CompletionService;
  callbacks: Callback[];

  constructor({
    modelId,
    modelName,
    modelType,
    model,
    provider,
    contextWindow,
    maxOutputTokens,
    completionService,
    callbacks,
  }: LLMChatModelParams) {
    this.modelId = modelId;
    this.modelName = modelName;
    this.modelType = modelType;
    this.model = model;
    this.provider = provider;
    this.contextWindow = contextWindow;
    this.maxOutputTokens = maxOutputTokens;
    this.completionService = completionService;
    this.callbacks = callbacks || [];
  }

  async call({ provider, request, callbacks }: ModelCallParams) {
    let _callbacks: Callback[];
    if (callbacks?.length) {
      _callbacks = callbacks;
    } else {
      _callbacks = this.callbacks;
    }
    let _provider: string;
    let _model: string;
    if (provider) {
      _provider = provider;
    } else {
      _provider = this.provider;
    }
    if (request.model) {
      _model = request.model;
    } else {
      _model = this.model;
    }
    const modelParamsWithDefaults = {
      ...defaultLLMChatModelParams,
      ...request.model_params,
    };
    request = {
      ...request,
      model: _model,
      model_params: modelParamsWithDefaults,
    };
    this.onStart({ provider: _provider, request }, _callbacks);
    try {
      const response = await this.completionService(this.provider, request);
      this.onEnd({ response: await convertResponseWithImages(response) }, _callbacks);
      return response;
    } catch (err) {
      const errors = err.errors || [{ message: String(err) }];
      this.onEnd({ errors }, _callbacks);
      throw err;
    }
  }

  onStart({ provider, request }: ModelCallParams, callbacks: Callback[]) {
    let params: any = { provider, request };
    if (request.model === this.model) {
      params = {
        ...params,
        modelId: this.modelId,
        modelName: this.modelName,
      };
    }
    for (let callback of callbacks) {
      callback.onCompletionModelStart(params);
    }
  }

  onEnd(params: ModelOnEndParams, callbacks: Callback[]) {
    for (let callback of callbacks) {
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

  async call({ args, isBatch, callbacks }: CustomModelCallParams) {
    let _callbacks: Callback[];
    if (callbacks?.length) {
      _callbacks = callbacks;
    } else {
      _callbacks = this.callbacks;
    }
    this.onStart({ args, isBatch }, _callbacks);
    try {
      let res: any;
      if (isBatch) {
        if (!this.batchEndpoint) {
          this.throwSemanticFunctionError('batch endpoint not supported', _callbacks);
        }
        res = await axios.post(this.batchEndpoint, args);
      } else {
        res = await axios.post(this.url, args);
      }
      const response = res.data;
      this.onEnd({ response }, _callbacks);
      return response;
    } catch (err) {
      const errors = err.errors || [{ message: String(err) }];
      this.onEnd({ errors }, _callbacks);
      throw err;
    }
  }

  onStart({ args, isBatch }: CustomModelCallParams, callbacks: Callback[]) {
    for (let callback of callbacks) {
      callback.onCustomModelStart({
        model: this.model,
        url: isBatch ? this.batchEndpoint : this.url,
        args,
        isBatch,
      });
    }
  }

  onEnd({ response, errors }: CustomModelOnEndParams, callbacks: Callback[]) {
    for (let callback of callbacks) {
      callback.onCustomModelEnd({
        model: this.model,
        response,
        errors,
      });
    }
  }

  throwSemanticFunctionError(message: string, callbacks: Callback[]) {
    const errors = [{ message }];
    for (let callback of callbacks) {
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

  async call({ args, callbacks }: HuggingfaceModelCallParams) {
    let _callbacks: Callback[];
    if (callbacks?.length) {
      _callbacks = callbacks;
    } else {
      _callbacks = this.callbacks;
    }
    this.onStart({ args }, _callbacks);
    try {
      const response = await this.modelProviderService.query('huggingface', this.model, args);
      this.onEnd({ response }, _callbacks);
      return response;
    } catch (err) {
      const errors = err.errors || [{ message: String(err) }];
      this.onEnd({ errors }, _callbacks);
      throw err;
    }
  }

  onStart({ args }: HuggingfaceModelCallParams, callbacks: Callback[]) {
    for (let callback of callbacks) {
      callback.onHuggingfaceModelStart({
        model: this.model,
        args,
      });
    }
  }

  onEnd({ response, errors }: HuggingfaceModelOnEndParams, callbacks: Callback[]) {
    for (let callback of callbacks) {
      callback.onHuggingfaceModelEnd({
        model: this.model,
        response,
        errors,
      });
    }
  }

  throwSemanticFunctionError(message: string, callbacks: Callback[]) {
    const errors = [{ message }];
    for (let callback of callbacks) {
      callback.onHuggingfaceModelError(errors);
    }
    throw new SemanticFunctionError(message);
  }

}

interface LLMModelOptions {
  modelId: number;
  modelName: string;
  model: string;
  provider: string;
  contextWindow: number;
  maxOutputTokens: number;
  completionService: CompletionService;
  semanticCache: SemanticCache;
  semanticCacheEnabled: boolean;
  callbacks: Callback[];
}

export const llmModel = (options: LLMModelOptions) => {
  return new LLMChatModel({
    ...options,
    modelType: 'gpt',
  });
}

interface LLMCompletionModelOptions {
  modelId: number;
  modelName: string;
  model: string;
  provider: string;
  contextWindow: number;
  maxOutputTokens: number;
  completionService: CompletionService;
  semanticCache: SemanticCache;
  semanticCacheEnabled: boolean;
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
