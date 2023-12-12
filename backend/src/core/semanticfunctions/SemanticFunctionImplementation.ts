import relativeTime from 'dayjs/plugin/relativeTime';
import { default as dayjs } from 'dayjs';
import { mapJsonAsync } from 'jsonpath-mapper';

import logger from '../../logger';

import { Callback } from '../callbacks/Callback';
import { DataMapper, Model } from '../common_types';
import {
  PARA_DELIM,
  Function,
  Message,
  ChatRequestContext,
  ResponseMetadata,
} from '../conversions/RosettaStone';
import { SemanticFunctionError } from '../errors';
import { InputGuardrails } from '../guardrails/InputGuardrails';
import { LLMModel } from '../models/llm_types';
import { UserMessage } from '../models/openai';
import { OutputProcessingPipeline } from '../outputprocessing/OutputProcessingPipeline';
import { PromptEnrichmentPipeline } from '../promptenrichment/PromptEnrichmentPipeline';
import { getInputString } from '../utils';
import { SemanticFunction } from './SemanticFunction';
import {
  SemanticFunctionImplementationParams,
  SemanticFunctionImplementationCallParams,
  SemanticFunctionImplementationOnEndParams,
} from './SemanticFunctionImplementation_types';

dayjs.extend(relativeTime);

const nonSystem = (m: Message) => m.role !== 'system';

export class SemanticFunctionImplementation {

  model: Model;
  isDefault: boolean;
  argsMappingTemplate?: string;
  returnMappingTemplate?: string;
  indexContentPropertyPath?: string;
  indexContextPropertyPath?: string;
  rewriteQuery?: boolean;
  summarizeResults?: boolean;
  promptEnrichmentPipeline?: PromptEnrichmentPipeline;
  inputGuardrails?: InputGuardrails;
  outputProcessingPipeline?: OutputProcessingPipeline;
  queryRewriteFunction: SemanticFunction;
  dataMapper: DataMapper;
  callbacks: Callback[];
  currentCallbacks: Callback[];

  constructor({
    model,
    isDefault,
    argsMappingTemplate,
    returnMappingTemplate,
    indexContentPropertyPath,
    indexContextPropertyPath,
    rewriteQuery,
    summarizeResults,
    promptEnrichmentPipeline,
    inputGuardrails,
    outputProcessingPipeline,
    queryRewriteFunction,
    dataMapper,
    callbacks,
  }: SemanticFunctionImplementationParams) {
    this.model = model;
    this.isDefault = isDefault;
    this.argsMappingTemplate = argsMappingTemplate;
    this.returnMappingTemplate = returnMappingTemplate;
    this.indexContentPropertyPath = indexContentPropertyPath;
    this.indexContextPropertyPath = indexContextPropertyPath;
    this.rewriteQuery = rewriteQuery;
    this.summarizeResults = summarizeResults;
    this.promptEnrichmentPipeline = promptEnrichmentPipeline;
    this.inputGuardrails = inputGuardrails;
    this.outputProcessingPipeline = outputProcessingPipeline;
    this.queryRewriteFunction = queryRewriteFunction;
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
      if (this.model.modelType === 'gpt' || this.model.modelType === 'completion') {
        const contextWindow = (this.model as LLMModel).contextWindow || 4096;
        let maxTokens = +modelParams.max_tokens;
        if (isNaN(maxTokens)) {
          maxTokens = 1024;
        }
        let messages: Message[];
        let context: ChatRequestContext;
        let hist: Message[];
        let msgs: Message[];
        let functions: Function[];

        if (this.rewriteQuery) {
          const content = args[this.indexContentPropertyPath];
          if (content) {
            const res = await this.queryRewriteFunction.call({
              args: { content },
              modelParams: { n: 1 },
              callbacks,
            });
            args[this.indexContentPropertyPath] = res.response.choices[0].message.content;
          }
        }
        if (this.promptEnrichmentPipeline) {
          messages = await this.promptEnrichmentPipeline.call({
            args,
            contextWindow,
            maxTokens,
            modelKey,
            callbacks,
          });
          if (!messages.length) {
            this.throwSemanticFunctionError('no prompt');
          }
          context = this.getContext(messages);
          if (history) {
            hist = this.getNonSystemMessageHistory(history);
          }
          msgs = this.getNonSystemMessages(messages);
          if (args.imageUrl) {
            msgs = [
              ...msgs.slice(0, -1),
              ...msgs.slice(-1).map(m => ({
                ...m,
                content: [
                  {
                    type: 'text',
                    text: m.content as string,
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: args.imageUrl,
                    },
                  },
                ],
              })),
            ];
          }
        } else {
          const text = this.getInput(args);
          let userMessage: UserMessage;
          if (args.imageUrl) {
            userMessage = new UserMessage([
              {
                type: 'text',
                text,
              },
              {
                type: 'image_url',
                image_url: {
                  url: args.imageUrl,
                },
              },
            ]);
          } else {
            userMessage = new UserMessage(text);
          }
          msgs = [userMessage];
        }
        if (this.inputGuardrails && this.inputGuardrails.length) {
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
        const request = {
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
        // }
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
      if (this.outputProcessingPipeline && this.outputProcessingPipeline.length) {
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

  getInput(args: any) {
    const content = getInputString(args);
    if (!content) {
      this.throwSemanticFunctionError('Cannot parse args');
    }
    return content;
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
  isDefault: boolean;
  argsMappingTemplate?: string;
  returnMappingTemplate?: string;
  indexContentPropertyPath?: string;
  indexContextPropertyPath?: string;
  rewriteQuery?: boolean;
  summarizeResults?: boolean;
  queryRewriteFunction?: SemanticFunction;
  callbacks?: Callback[];
}

export const semanticFunctionImplementation = (options: SemanticFunctionImplementationOptions) => (
  model: Model,
  promptEnrichmentPipeline: PromptEnrichmentPipeline,
  inputGuardrails: InputGuardrails,
  outputProcessingPipeline: OutputProcessingPipeline,
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