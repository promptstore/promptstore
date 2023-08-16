import { default as dayjs } from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { mapJsonAsync } from 'jsonpath-mapper';

import { DataMapper } from './common_types';
import { SemanticFunctionError } from './errors';
import { Callback } from './Callback';
import { InputGuardrails } from './InputGuardrails';
import { Model } from './Model_types';
import { OutputProcessingPipeline } from './OutputProcessingPipeline';
import { IMessage } from './PromptTemplate_types';
import {
  SemanticFunctionImplementationParams,
  SemanticFunctionImplementationCallParams,
  SemanticFunctionImplementationOnEndParams,
} from './SemanticFunctionImplementation_types';
import { PromptEnrichmentPipeline } from './PromptEnrichmentPipeline';
import { UserMessage } from './PromptTemplate_types';
import { getInputString } from './utils';

dayjs.extend(relativeTime);

export class SemanticFunctionImplementation {

  model: Model;
  argsMappingTemplate?: any;
  returnMappingTemplate?: any;
  isDefault: boolean;
  promptEnrichmentPipeline?: PromptEnrichmentPipeline;
  inputGuardrails?: InputGuardrails;
  outputProcessingPipeline?: OutputProcessingPipeline;
  dataMapper: DataMapper;
  callbacks: Callback[];
  currentCallbacks: Callback[];

  constructor({
    model,
    argsMappingTemplate,
    returnMappingTemplate,
    isDefault,
    promptEnrichmentPipeline,
    inputGuardrails,
    outputProcessingPipeline,
    dataMapper,
    callbacks,
  }: SemanticFunctionImplementationParams) {
    this.model = model;
    this.argsMappingTemplate = argsMappingTemplate;
    this.returnMappingTemplate = returnMappingTemplate;
    this.isDefault = isDefault;
    this.promptEnrichmentPipeline = promptEnrichmentPipeline;
    this.inputGuardrails = inputGuardrails;
    this.outputProcessingPipeline = outputProcessingPipeline;
    this.dataMapper = dataMapper || mapJsonAsync;
    this.callbacks = callbacks || [];
  }

  async call({ args, history, modelKey, modelParams, isBatch, callbacks = [] }: SemanticFunctionImplementationCallParams) {
    this.currentCallbacks = [...this.callbacks, ...callbacks];
    this.onStart({ args, history, modelKey, modelParams, isBatch });
    try {
      if (this.argsMappingTemplate) {
        args = await this.mapArgs(args, this.argsMappingTemplate, isBatch);
      }
      let response: any;
      if (this.model.modelType === 'gpt') {
        let messages: IMessage[];
        if (this.promptEnrichmentPipeline) {
          messages = await this.promptEnrichmentPipeline.call({ args, callbacks });
          if (history) {
            messages = this.includeHistory(messages, history);
          }
        } else {
          messages = this.getNoPromptMessages(args);
        }
        if (this.inputGuardrails) {
          await this.inputGuardrails.call({ messages });
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
      if (this.outputProcessingPipeline) {
        response = await this.outputProcessingPipeline.call({ response, callbacks });
      }
      if (this.returnMappingTemplate) {
        response = await this.mapReturnType(response, this.returnMappingTemplate, isBatch);
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
    for (let callback of this.currentCallbacks) {
      callback.onMapArguments({
        args,
        mapped,
        mappingTemplate,
        isBatch,
      });
    }
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

  onStart({ args, history, modelKey, modelParams, isBatch }: SemanticFunctionImplementationCallParams) {
    for (let callback of this.currentCallbacks) {
      callback.onSemanticFunctionImplementationStart({
        args,
        history,
        modelType: this.model.modelType,
        modelKey,
        modelParams,
        isBatch,
      });
    }
  }

  async mapReturnType(response: any, mappingTemplate: any, isBatch: boolean) {
    const mapped = await this._mapArgs(response, mappingTemplate, isBatch);
    for (let callback of this.currentCallbacks) {
      callback.onMapReturnType({
        response,
        mapped,
        mappingTemplate,
        isBatch,
      });
    }
    return mapped;
  }

  onEnd({ response, errors }: SemanticFunctionImplementationOnEndParams) {
    for (let callback of this.currentCallbacks) {
      callback.onSemanticFunctionImplementationEnd({
        modelKey: this.model.modelKey,
        response,
        errors,
      });
    }
  }

  throwSemanticFunctionError(message: string) {
    const errors = [{ message }];
    for (let callback of this.currentCallbacks) {
      callback.onSemanticFunctionImplementationError(errors);
    }
    throw new SemanticFunctionError(message);
  }

}

interface SemanticFunctionImplementationOptions {
  argsMappingTemplate?: any;
  returnMappingTemplate?: any;
  isDefault: boolean;
  callbacks?: Callback[];
}

export const semanticFunctionImplementation = (options: SemanticFunctionImplementationOptions) => (model: Model, promptEnrichmentPipeline: PromptEnrichmentPipeline, inputGuardrails: InputGuardrails, outputProcessingPipeline: OutputProcessingPipeline) => {
  return new SemanticFunctionImplementation({
    ...options,
    model,
    promptEnrichmentPipeline,
    inputGuardrails,
    outputProcessingPipeline,
  });
}
