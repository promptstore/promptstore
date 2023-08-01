import * as dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

import logger from '../logger';

import {
  Model,
  LLMChatModelParams,
  ModelCallParams,
  ChatCompletionService,
  OnModelStartCallbackFunction,
  OnModelEndCallbackFunction,
  OnModelErrorCallbackFunction,
  OnModelEndParams,
} from './Model_types';
import { Tracer } from './Tracer';

dayjs.extend(relativeTime);

const defaultLLMChatModelParams = {
  maxTokens: 140,
  n: 1,
};

export class LLMChatModel implements Model {

  modelKey: string;
  chatCompletionService: ChatCompletionService;
  tracer: Tracer;
  onModelStart?: OnModelStartCallbackFunction;
  onModelEnd?: OnModelEndCallbackFunction;
  onModelError?: OnModelErrorCallbackFunction;
  startTime: Date;

  constructor({
    modelKey,
    chatCompletionService,
    onModelStart,
    onModelEnd,
    onModelError,
  }: LLMChatModelParams) {
    this.modelKey = modelKey;
    this.chatCompletionService = chatCompletionService;
    this.tracer = new Tracer(this.getTraceName());
    this.onModelStart = onModelStart;
    this.onModelEnd = onModelEnd;
    this.onModelError = onModelError;
  }

  async call({ messages, modelKey, modelParams }: ModelCallParams) {
    const modelParamsWithDefaults = {
      ...defaultLLMChatModelParams,
      ...modelParams
    };
    const myModelKey = modelKey || this.modelKey;

    this.onStart({ messages, modelKey: myModelKey, modelParams });
    const response = await this.chatCompletionService({
      messages,
      modelKey: myModelKey,
      modelParams: modelParamsWithDefaults,
    });
    this.onEnd({ response });

    return response;
  }

  getTraceName() {
    return [this.modelKey, new Date().toISOString()].join(' - ');
  }

  onStart({ messages, modelKey, modelParams }: ModelCallParams) {
    logger.info('start model:', modelKey);
    this.startTime = new Date();
    this.tracer.push({
      type: 'call-model',
      model: {
        modelKey,
        modelParams,
      },
      messages,
      startTime: this.startTime.getTime(),
    });
    if (this.onModelStart) {
      this.onModelStart({
        messages,
        modelKey,
        modelParams,
        trace: this.tracer.currentTrace(),
      });
    }
  }

  onEnd({ response }: OnModelEndParams) {
    logger.info('end model:', this.modelKey);
    const endTime = new Date();
    this.tracer
      .addProperty('response', response)
      .addProperty('endTime', endTime.getTime())
      .addProperty('elapsedMillis', endTime.getTime() - this.startTime.getTime())
      .addProperty('elapsedReadable', dayjs(endTime).from(this.startTime))
      .addProperty('success', true);
    if (this.onModelEnd) {
      this.onModelEnd({
        response,
        trace: this.tracer.currentTrace(),
      });
    }
  }

}
