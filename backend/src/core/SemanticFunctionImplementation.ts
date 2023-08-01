import * as dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { mapJsonAsync } from 'jsonpath-mapper';

import logger from '../logger';

import { DataMapper } from './common_types';
import { Model } from './Model_types';
import {
  SemanticFunctionImplementationParams,
  SemanticFunctionImplementationCallParams,
  OnSemanticFunctionImplementationStartCallbackFunction,
  OnSemanticFunctionImplementationEndCallbackFunction,
  OnSemanticFunctionImplementationErrorCallbackFunction,
  OnSemanticFunctionImplementationEndParams,
} from './SemanticFunctionImplementation_types';
import { PromptEnrichmentPipeline } from './PromptEnrichmentPipeline';
import { Tracer } from './Tracer';

dayjs.extend(relativeTime);

export class SemanticFunctionImplementation {

  model: Model;
  promptEnrichmentPipeline: PromptEnrichmentPipeline;
  isDefault: boolean;
  argsMappingTemplate?: any;
  dataMapper: DataMapper;
  tracer: Tracer;
  onSemanticFunctionImplementationStart?: OnSemanticFunctionImplementationStartCallbackFunction;
  onSemanticFunctionImplementationEnd?: OnSemanticFunctionImplementationEndCallbackFunction;
  onSemanticFunctionImplementationError?: OnSemanticFunctionImplementationErrorCallbackFunction;
  startTime: Date;

  constructor({
    model,
    promptEnrichmentPipeline,
    isDefault,
    argsMappingTemplate,
    dataMapper,
    onSemanticFunctionImplementationStart,
    onSemanticFunctionImplementationEnd,
    onSemanticFunctionImplementationError,
  }: SemanticFunctionImplementationParams) {
    this.model = model;
    this.promptEnrichmentPipeline = promptEnrichmentPipeline;
    this.isDefault = isDefault;
    this.argsMappingTemplate = argsMappingTemplate;
    this.dataMapper = dataMapper || mapJsonAsync;
    this.tracer = new Tracer(this.getTraceName());
    this.onSemanticFunctionImplementationStart = onSemanticFunctionImplementationStart;
    this.onSemanticFunctionImplementationEnd = onSemanticFunctionImplementationEnd;
    this.onSemanticFunctionImplementationError = onSemanticFunctionImplementationError;
  }

  async call({ args, modelKey, modelParams, isBatch }: SemanticFunctionImplementationCallParams) {
    this.onStart({ args, modelKey, modelParams, isBatch });
    if (this.argsMappingTemplate) {
      args = await this.mapArgs(args, this.argsMappingTemplate, isBatch);
    }

    this.promptEnrichmentPipeline.onPromptEnrichmentEnd = ({ trace }) => {
      this.tracer.addProperty('children', trace);
    };
    this.model.onModelEnd = ({ trace }) => {
      this.tracer.addProperty('children', trace);
    };

    const messages = await this.promptEnrichmentPipeline.call({ args });

    const response = await this.model.call({
      messages,
      modelKey,
      modelParams,
    });

    this.onEnd({ response });

    return response;
  }

  async mapArgs(args: any, mappingTemplate: any, isBatch: boolean) {
    const mapped = await this._mapArgs(args, mappingTemplate, isBatch);
    logger.debug('mapping function-to-prompt args');
    logger.debug('args:', args);
    logger.debug('mappingTemplate:', mappingTemplate);
    if (!isBatch) {
      logger.debug('result:', mapped);
    }
    this.tracer.push({
      type: 'map-args',
      input: {
        type: 'function-args',
        values: !isBatch && args,
      },
      output: {
        type: 'prompt-args',
        values: !isBatch && mapped,
      },
    });
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

  onStart({ args, modelKey, modelParams, isBatch }: SemanticFunctionImplementationCallParams) {
    logger.info('start implementation:', modelKey);
    this.startTime = new Date();
    this.tracer.push({
      type: 'call-implementation',
      implementation: {
        model: {
          modelKey,
          modelParams,
        },
      },
      isBatch,
      args,
      startTime: this.startTime.getTime(),
    });
    if (this.onSemanticFunctionImplementationStart) {
      this.onSemanticFunctionImplementationStart({
        args,
        modelKey,
        modelParams,
        isBatch,
        trace: this.tracer.currentTrace(),
      });
    }
  }

  onEnd({ response }: OnSemanticFunctionImplementationEndParams) {
    logger.info('end implementation:', this.model.modelKey);
    const endTime = new Date();
    this.tracer
      .addProperty('response', response)
      .addProperty('endTime', endTime.getTime())
      .addProperty('elapsedMillis', endTime.getTime() - this.startTime.getTime())
      .addProperty('elapsedReadable', dayjs(endTime).from(this.startTime))
      .addProperty('success', true);
    if (this.onSemanticFunctionImplementationEnd) {
      this.onSemanticFunctionImplementationEnd({
        response,
        trace: this.tracer.currentTrace(),
      });
    }
  }

}
