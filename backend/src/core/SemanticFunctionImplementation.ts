import { default as dayjs } from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { mapJsonAsync } from 'jsonpath-mapper';

import logger from '../logger';

import { DataMapper } from './common_types';
import { SemanticFunctionError } from './errors';
import { Callback } from './Callback';
import { Model } from './Model_types';
import { IMessage } from './PromptTemplate_types';
import {
  SemanticFunctionImplementationParams,
  SemanticFunctionImplementationCallParams,
  SemanticFunctionImplementationOnEndParams,
} from './SemanticFunctionImplementation_types';
import { PromptEnrichmentPipeline } from './PromptEnrichmentPipeline';
import { UserMessage } from './PromptTemplate_types';
// import { Tracer } from './Tracer';
import { getInputString } from './utils';

dayjs.extend(relativeTime);

export class SemanticFunctionImplementation {

  model: Model;
  argsMappingTemplate?: any;
  isDefault: boolean;
  promptEnrichmentPipeline?: PromptEnrichmentPipeline;
  dataMapper: DataMapper;
  callbacks: Callback[];
  currentCallbacks: Callback[];
  // tracer: Tracer;
  // startTime: Date;

  constructor({
    model,
    argsMappingTemplate,
    isDefault,
    promptEnrichmentPipeline,
    dataMapper,
    callbacks,
  }: SemanticFunctionImplementationParams) {
    this.model = model;
    this.argsMappingTemplate = argsMappingTemplate;
    this.isDefault = isDefault;
    this.promptEnrichmentPipeline = promptEnrichmentPipeline;
    this.dataMapper = dataMapper || mapJsonAsync;
    this.callbacks = callbacks || [];
    // this.tracer = new Tracer(this.getTraceName());
  }

  async call({ args, history, modelKey, modelParams, isBatch, callbacks = [] }: SemanticFunctionImplementationCallParams) {
    this.currentCallbacks = [...this.callbacks, ...callbacks];
    this.onStart({ args, history, modelKey, modelParams, isBatch });
    try {
      if (this.argsMappingTemplate) {
        args = await this.mapArgs(args, this.argsMappingTemplate, isBatch);
      }
      // this.model.tracer = this.tracer;
      let response: any;
      if (this.model.modelType === 'gpt') {
        let messages: IMessage[];
        if (this.promptEnrichmentPipeline) {
          // this.promptEnrichmentPipeline.tracer = this.tracer;
          messages = await this.promptEnrichmentPipeline.call({ args, callbacks });
          if (history) {
            messages = this.includeHistory(messages, history);
          }
        } else {
          messages = this.getNoPromptMessages(args);
        }
        response = await this.model.call({
          messages,
          modelKey,
          modelParams,
          callbacks
        });
      } else if (this.model.modelType === 'api') {
        response = await this.model.call({
          args,
          isBatch,
          callbacks
        });
      } else {
        this.throwSemanticFunctionError(`model type ${this.model.modelType} not supported`);
      }
      this.onEnd({ response });
      return response;
    } catch (err) {
      const errors = err.errors || [{ message: String(err) }];
      this.onEnd({ errors });
      throw err;
    }
  }

  getNoPromptMessages(args: any) {
    const content = getInputString(args);
    if (!content) {
      this.throwSemanticFunctionError('Cannot parse args');
    }
    const message = new UserMessage(content);
    return [message];
  }

  includeHistory(messages: IMessage[], history: IMessage[]) {
    const systemMessages = messages.filter(m => m.role === 'system');
    const notSystem = (m: IMessage) => m.role !== 'system';
    return [
      ...systemMessages,
      ...history.filter(notSystem),
      ...messages.filter(notSystem)
    ];
  }

  async mapArgs(args: any, mappingTemplate: any, isBatch: boolean) {
    const mapped = await this._mapArgs(args, mappingTemplate, isBatch);
    // logger.debug('mapping function-to-prompt args');
    // logger.debug('args:', args);
    // logger.debug('mappingTemplate:', mappingTemplate);
    // if (!isBatch) {
    //   logger.debug('result:', mapped);
    // }
    // this.tracer.push({
    //   type: 'map-args',
    //   input: {
    //     type: 'function-args',
    //     values: !isBatch && args,
    //   },
    //   output: {
    //     type: 'args',
    //     values: !isBatch && mapped,
    //   },
    //   mappingTemplate,
    // });
    return mapped;
  }

  _mapArgs(args: any, mappingTemplate: any, isBatch: boolean): Promise<any> {
    const template = eval(`(${mappingTemplate})`);
    const mapData = (instance: object) => this.dataMapper(instance, template);
    if (isBatch) {
      return Promise.all(args.map(mapData));
    }
    return mapData(args);
  }

  getTraceName() {
    return ['impl', this.model.modelKey, new Date().toISOString()].join(' - ');
  }

  onStart({ args, history, modelKey, modelParams, isBatch }: SemanticFunctionImplementationCallParams) {
    // logger.info('start implementation:', modelKey);
    // this.startTime = new Date();
    // this.tracer.push({
    //   type: 'call-implementation',
    //   implementation: {
    //     modelType: this.model.modelType,
    //     model: modelKey,
    //     modelParams,
    //   },
    //   isBatch,
    //   args,
    //   history,
    //   startTime: this.startTime.getTime(),
    // });
    for (let callback of this.currentCallbacks) {
      callback.onSemanticFunctionImplementationStart({
        args,
        history,
        modelType: this.model.modelType,
        modelKey,
        modelParams,
        isBatch,
        // trace: this.tracer.currentTrace(),
      });
    }
    // this.tracer.down();
  }

  onEnd({ response, errors }: SemanticFunctionImplementationOnEndParams) {
    // logger.info('end implementation:', this.model.modelKey);
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
      callback.onSemanticFunctionImplementationEnd({
        modelKey: this.model.modelKey,
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
      callback.onSemanticFunctionImplementationError(errors);
    }
    throw new SemanticFunctionError(message);
  }

}

interface SemanticFunctionImplementationOptions {
  argsMappingTemplate?: any;
  isDefault: boolean;
  callbacks?: Callback[];
}

export const semanticFunctionImplementation = (options: SemanticFunctionImplementationOptions) => (model: Model, promptEnrichmentPipeline: PromptEnrichmentPipeline) => {
  return new SemanticFunctionImplementation({
    ...options,
    model,
    promptEnrichmentPipeline,
  });
}
