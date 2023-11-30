import relativeTime from 'dayjs/plugin/relativeTime';
import { default as dayjs } from 'dayjs';
import { mapJsonAsync } from 'jsonpath-mapper';

import logger from '../../logger';

import { DataMapper, Model } from '../common_types';
import { SemanticFunctionError } from '../errors';
import { UserMessage } from '../models/openai';
import { getInputString } from '../utils';
import { Callback } from '../callbacks/Callback';
import { InputGuardrails } from '../guardrails/InputGuardrails';
import { OutputProcessingPipeline } from '../outputprocessing/OutputProcessingPipeline';
import {
  SemanticFunctionImplementationParams,
  SemanticFunctionImplementationCallParams,
  SemanticFunctionImplementationOnEndParams,
} from './SemanticFunctionImplementation_types';
import { PromptEnrichmentPipeline } from '../promptenrichment/PromptEnrichmentPipeline';
import {
  PARA_DELIM,
  MultiModalChatRequest,
  Function,
  Message,
  MessageRole,
  VisionMessage,
  ChatRequestContext,
  ResponseMetadata,
} from '../conversions/RosettaStone';

dayjs.extend(relativeTime);

const nonSystem = (m: Message) => m.role !== 'system';

export class SemanticFunctionImplementation {

  model: Model;
  argsMappingTemplate?: string;
  returnMappingTemplate?: string;
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

  async call({
    args,
    history,
    modelKey,
    modelParams,
    isBatch,
    returnTypeSchema,
    callbacks = [],
  }: SemanticFunctionImplementationCallParams) {
    this.currentCallbacks = [...this.callbacks, ...callbacks];
    modelKey = modelKey || this.model.model;
    this.onStart({ args, history, modelKey, modelParams, isBatch });
    try {
      if (this.argsMappingTemplate) {
        args = await this.mapArgs(args, this.argsMappingTemplate, isBatch);
      }
      let response: any;
      let responseMetadata: ResponseMetadata;
      if (this.model.modelType === 'gpt') {
        let messages: Message[];
        let visionMessages: VisionMessage[];
        let context: ChatRequestContext;
        let hist: Message[];
        let msgs: Message[];
        let functions: Function[];

        if (args.imageUrl) {
          if (this.promptEnrichmentPipeline) {
            messages = await this.promptEnrichmentPipeline.call({ args, callbacks });
            visionMessages = [
              ...messages.slice(0, -1)?.map(m => ({
                role: m.role,
                content: m.content,
              })),
              {
                role: MessageRole.user,
                content: [
                  {
                    type: 'text',
                    text: messages.slice(-1)[0].content,
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: args.imageUrl,
                    },
                  },
                ],
              },
            ];
          } else {
            const userMessage = this.getInputAsMessage(args);
            visionMessages = [
              {
                role: MessageRole.user,
                content: [
                  {
                    type: 'text',
                    text: userMessage.content,
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: args.imageUrl,
                    },
                  },
                ],
              },
            ];
          }
        } else {
          if (this.promptEnrichmentPipeline) {
            messages = await this.promptEnrichmentPipeline.call({ args, callbacks });
            if (!messages.length) {
              this.throwSemanticFunctionError('no prompt');
            }
            context = this.getContext(messages);
            if (history) {
              hist = this.getNonSystemMessageHistory(history);
            }
            msgs = this.getNonSystemMessages(messages);
          } else {
            const userMessage = this.getInputAsMessage(args);
            msgs = [userMessage];
          }
        }

        if (this.inputGuardrails) {
          await this.inputGuardrails.call({ messages, callbacks });
        }
        if (returnTypeSchema) {
          const outputFormatter = new Func(
            'output_formatter',
            'Output formatter. Should always be used to format your response to the user',
            returnTypeSchema
          );
          functions = [outputFormatter.toJSON()];
        }
        let request: MultiModalChatRequest;
        if (args.imageUrl) {
          request = {
            model: modelKey,
            max_tokens: modelParams.max_tokens,
            messages: visionMessages,
          };
          response = await this.model.call({ request, callbacks, vision: true });
        } else {
          request = {
            model: modelKey,
            model_params: modelParams,
            functions,
            prompt: {
              context,
              history: hist,
              messages: msgs,
            }
          };
          response = await this.model.call({ request, callbacks });
        }
        responseMetadata = {
          prompts: messages,
        };
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
      return {
        response,
        responseMetadata,
      };
    } catch (err) {
      const errors = err.errors || [{ message: String(err) }];
      this.onEnd({ errors });
      throw err;
    }
  }

  getContext(messages: Message[]) {
    const system_prompt = messages
      .filter(m => m.role === 'system')
      .map(m => m.content)
      .join(PARA_DELIM)
      ;
    return { system_prompt };
  }

  getNonSystemMessageHistory(history: Message[]) {
    return history.filter(nonSystem);
  }

  getNonSystemMessages(messages: Message[]) {
    return messages.filter(nonSystem);
  }

  getInputAsMessage(args: any) {
    const content = getInputString(args);
    if (!content) {
      this.throwSemanticFunctionError('Cannot parse args');
    }
    return new UserMessage(content);
  }

  async mapArgs(args: any, mappingTemplate: string, isBatch: boolean) {
    try {
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
    } catch (err) {
      for (let callback of this.currentCallbacks) {
        callback.onMapArguments({
          args,
          mappingTemplate,
          isBatch,
          errors: [{ message: String(err) }],
        });
      }
    }
  }

  _mapArgs(args: any, mappingTemplate: string, isBatch: boolean): Promise<any> {
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

  async mapReturnType(response: any, mappingTemplate: string, isBatch: boolean) {
    try {
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
    } catch (err) {
      for (let callback of this.currentCallbacks) {
        callback.onMapReturnType({
          response,
          mappingTemplate,
          isBatch,
          errors: [{ message: String(err) }],
        });
      }
    }
  }

  onEnd({ response, errors }: SemanticFunctionImplementationOnEndParams) {
    for (let callback of this.currentCallbacks) {
      callback.onSemanticFunctionImplementationEnd({
        modelKey: this.model.model,
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
  argsMappingTemplate?: string;
  returnMappingTemplate?: string;
  isDefault: boolean;
  callbacks?: Callback[];
}

export const semanticFunctionImplementation = (options: SemanticFunctionImplementationOptions) => (
  model: Model,
  promptEnrichmentPipeline: PromptEnrichmentPipeline,
  inputGuardrails: InputGuardrails,
  outputProcessingPipeline: OutputProcessingPipeline
) => {
  return new SemanticFunctionImplementation({
    ...options,
    model,
    promptEnrichmentPipeline,
    inputGuardrails,
    outputProcessingPipeline,
  });
}

class Func implements Function {

  name: string;
  description: string;
  parameters: any;

  constructor(name: string, description: string, parameters: any) {
    this.name = name;
    this.description = description;
    this.parameters = parameters;
  }

  toJSON() {
    return {
      name: this.name,
      description: this.description,
      parameters: this.parameters,
    };
  }

}