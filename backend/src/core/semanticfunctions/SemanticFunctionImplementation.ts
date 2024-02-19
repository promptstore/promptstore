import axios from 'axios';
import relativeTime from 'dayjs/plugin/relativeTime';
import sizeOf from 'image-size';
import { default as dayjs } from 'dayjs';
import { mapJsonAsync } from 'jsonpath-mapper';

import logger from '../../logger';

import { binPackTextsInOrder, getInput, hashStr } from '../../utils';
import { Callback } from '../callbacks/Callback';
import { DataMapper, Model } from '../common_types';
import {
  PARA_DELIM,
  ContentObject,
  Function,
  ImageContent,
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
import { EnrichmentPipelineResponse } from '../promptenrichment/PromptEnrichmentPipeline_types';
import { convertResponseWithImages } from '../utils';
import { SemanticFunction } from './SemanticFunction';
import {
  SemanticFunctionImplementationParams,
  SemanticFunctionImplementationCallParams,
  SemanticFunctionImplementationOnEndParams,
} from './SemanticFunctionImplementation_types';

dayjs.extend(relativeTime);

const DEFAULT_CONTEXT_WINDOW = 4096;

const DEFAULT_MAX_TOKENS = 1024;

interface GetInputParams {
  args: any;
  isBatch?: boolean;
  options?: any;
}

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
    messages,
    history,
    extraSystemPrompt,
    model,
    modelParams,
    functions,
    isBatch,
    returnTypeSchema,
    options,
    callbacks,
  }: SemanticFunctionImplementationCallParams) {
    let _callbacks: Callback[];
    if (callbacks?.length) {
      _callbacks = callbacks;
    } else {
      _callbacks = this.callbacks;
    }
    let modelKey: string;
    let provider: string;
    if (model) {
      modelKey = model.model;
      provider = model.provider;
    } else {
      modelKey = this.model.model;
      provider = this.model.provider;
    }
    this.onStart({
      args,
      history,
      messages,
      model: { model: modelKey, provider },
      modelParams,
      isBatch,
      options,
    }, _callbacks);
    if (!options) {
      options = {};
    }
    logger.debug('options:', options);
    try {
      if (this.argsMappingTemplate) {
        args = await this.mapArgs(args, this.argsMappingTemplate, isBatch, _callbacks);
      }
      let response: any;
      let responseMetadata: Partial<ResponseMetadata>;

      if (this.model.modelType === 'gpt' || this.model.modelType === 'completion') {
        /********************************************
         ** GPT
         ********************************************/
        let { contextWindow, maxOutputTokens } = this.model as LLMModel;
        if (!maxOutputTokens) maxOutputTokens = contextWindow;
        if (!contextWindow) {
          contextWindow = DEFAULT_CONTEXT_WINDOW;
        }
        let maxTokens = +modelParams.max_tokens;

        // TODO review
        if (options.maxTokensRelativeToContextWindow) {
          // maxTokens = Math.floor(contextWindow * options.maxTokensRelativeToContextWindow);
          maxTokens = Math.floor(maxOutputTokens * options.maxTokensRelativeToContextWindow);
        }
        if (isNaN(maxTokens)) {
          maxTokens = DEFAULT_MAX_TOKENS;
        }

        if (args && isBatch) {
          // const maxTokensPerRequest = contextWindow * 0.75;  // leave a little buffer

          // unlike context, batch token limits are bound by what can be output
          const maxTokensPerRequest = maxOutputTokens * 0.75;

          const maxTokensPerChat = maxTokensPerRequest - maxTokens;
          const originalTexts = this.getInput({ args, isBatch, options }, _callbacks);
          const originalHashes = [];
          const dedupedInputs = [];
          const allProps = options.contentProp === '__all';
          let i = 0;
          for (const text of originalTexts) {
            if (text && typeof text === 'string' && text.trim().length) {
              const hash = hashStr(text);
              // de-dup
              if (originalHashes.indexOf(hash) === -1) {
                if (allProps) {
                  dedupedInputs.push(args[i]);
                } else {
                  dedupedInputs.push(text);
                }
              }
              originalHashes.push(hash);
            } else {
              originalHashes.push(null);
            }
            i += 1;
          }
          // logger.debug('originalHashes:', originalHashes);

          const bins: string[][] = binPackTextsInOrder(dedupedInputs, maxTokensPerChat);
          // logger.debug('bins:', bins);

          const data = Array(originalHashes.length).fill(null);
          const proms = bins.map((inputs, i) => {
            let batchArgs: any;
            if (allProps) {
              batchArgs = inputs;
            } else {
              batchArgs = { [options.contentProp || 'text']: inputs };
            }
            this.onBatchBinStart({
              bin: i,
              size: inputs.length,
            }, _callbacks);
            const res = this.runImplementation({
              args: batchArgs,
              extraSystemPrompt,
              history,
              messages,
              contextWindow,
              maxOutputTokens,
              maxTokens,
              model: { model: modelKey, provider },
              modelParams,
              functions,
              returnTypeSchema,
              isBatch,
              callbacks: _callbacks.map(cb => cb.clone()),
            });
            this.onBatchBinEnd({ errors: null }, _callbacks);
            return res;
          });
          const res = await Promise.all(proms);  // preserves order

          let hist: Message[] = [];
          let prompts: Message[] = [];
          let costComponents = [];
          let totalCost = 0;
          let promptTokens = 0;
          let completionTokens = 0;
          let totalTokens = 0;

          i = 0;  // bin iteration
          for (const { response, responseMetadata } of res) {
            if (responseMetadata) {
              hist.push(...(responseMetadata.hist || []));
              prompts.push(...(responseMetadata.prompts || []));  // to calculate image costs
              costComponents.push(...(responseMetadata.costComponents || []));
              totalCost += responseMetadata.totalCost || 0;
              promptTokens += responseMetadata.promptTokens || 0;
              completionTokens += responseMetadata.completionTokens || 0;
              totalTokens += responseMetadata.totalTokens || 0;
            }
            // if (errors) {
            //   logger.error('Error parsing response (bin %d):', i + 1, errors);
            //   continue;
            // }
            try {
              const serializedJson = response.choices[0].message.function_call.arguments;
              const json = JSON.parse(serializedJson);
              // const values = json.results.map((el: any) => el[args.featureName]);
              const values = json.results.map((el: any) => el[options.batchResultKey]);
              for (let j = 0; j < values.length; j++) {  // value iteration
                let hash: string;
                if (allProps) {
                  hash = hashStr(JSON.stringify(bins[i][j]));
                } else {
                  hash = hashStr(bins[i][j]);
                }
                let k = -1;
                while ((k = originalHashes.indexOf(hash, k + 1)) !== -1) {  // matching hash index iteration
                  data[k] = values[j];
                }
              }
            } catch (err) {
              logger.error('Error parsing response (bin %d):', i + 1, err);
            }
            i += 1;
          }
          const last = res[res.length - 1];
          response = {
            ...last.response,
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  function_call: {
                    name: 'json',
                    arguments: JSON.stringify(data),
                  },
                  finish_reason: 'function_call',
                },
              },
            ],
          };
          const images = await this.getImages([...hist, ...prompts]);
          responseMetadata = {
            images,
            totalCost,
            costComponents,
            provider: this.model.provider,
            promptTokens,
            completionTokens,
            totalTokens,
          };

        } else {
          const res = await this.runImplementation({
            args,
            extraSystemPrompt,
            history,
            messages,
            contextWindow,
            maxOutputTokens,
            maxTokens,
            model: { model: modelKey, provider },
            modelParams,
            functions,
            returnTypeSchema,
            isBatch,
            callbacks: _callbacks,
          });
          response = res.response;

          // TODO - could there be images in the history
          const images = await this.getImages([
            ...(res.responseMetadata.hist || []),
            ...res.responseMetadata.prompts
          ]);
          responseMetadata = {
            ...res.responseMetadata,
            images,
            provider: this.model.provider,
          }
        }

      } else if (this.model.modelType === 'api') {
        /********************************************
         ** API
         ********************************************/
        response = await this.model.call({
          args,
          isBatch,
          callbacks: _callbacks
        });

      } else {
        this.throwSemanticFunctionError(`model type ${this.model.modelType} not supported`, _callbacks);
      }

      if (this.outputProcessingPipeline && this.outputProcessingPipeline.length) {
        response = await this.outputProcessingPipeline.call({ response, callbacks: _callbacks });
      }

      if (this.returnMappingTemplate) {
        response = await this.mapReturnType(response, this.returnMappingTemplate, isBatch, _callbacks);
      }

      this.onEnd({
        model: { model: modelKey, provider },
        response: await convertResponseWithImages(response),
      }, _callbacks);

      return { response, responseMetadata };
    } catch (err) {
      const errors = err.errors || [{ message: String(err) }];
      this.onEnd({ model: { model: modelKey, provider }, errors }, _callbacks);
      throw err;
    }
  }

  async runImplementation({
    args,
    extraSystemPrompt,
    history,
    messages,
    contextWindow,
    maxOutputTokens,
    maxTokens,
    model,
    modelParams,
    functions,
    returnTypeSchema,
    isBatch,
    callbacks,
  }) {
    let context: ChatRequestContext;
    let hist: Message[];
    let prompts: Message[];
    let enrichmentPipelineResponse: EnrichmentPipelineResponse;
    const costComponents = [];
    let totalCost = 0;
    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;

    if (this.rewriteQuery) {
      const content = args[this.indexContentPropertyPath];
      // logger.debug('rewriteQuery before:', content);
      if (content) {
        const { response, responseMetadata } = await this.queryRewriteFunction.call({
          args: { content },
          modelParams: { n: 1 },
          callbacks,
        });
        if (responseMetadata) {
          costComponents.push(...(responseMetadata.costComponents || []));
          totalCost += responseMetadata.totalCost || 0;
          promptTokens += responseMetadata.promptTokens || 0;
          completionTokens += responseMetadata.completionTokens || 0;
          totalTokens += responseMetadata.totalTokens || 0;
        }
        args[this.indexContentPropertyPath] = response.choices[0].message.content;
        // logger.debug('rewriteQuery after:', args[this.indexContentPropertyPath]);
      }
    }

    if (this.promptEnrichmentPipeline) {
      enrichmentPipelineResponse = await this.promptEnrichmentPipeline.call({
        args,
        messages,
        contextWindow,
        maxOutputTokens,
        maxTokens,
        isBatch,
        callbacks,
      });
      const enrichedMessages = enrichmentPipelineResponse.messages;
      if (!enrichedMessages.length) {
        this.throwSemanticFunctionError('no prompt', callbacks);
      }
      context = this.getContext(enrichedMessages);
      if (history) {
        hist = this.getNonSystemMessageHistory(history);
      }
      prompts = this.getNonSystemMessages(enrichedMessages);
      if (args.imageUrls) {
        prompts = [
          ...prompts.slice(0, -1),
          ...prompts.slice(-1).map(m => ({
            ...m,
            content: [
              {
                type: 'text',
                text: m.content as string,
              },
              ...args.imageUrls.map((url: string) => ({
                type: 'image_url',
                image_url: { url },
              }))
            ],
          })),
        ];
      }

    } else {
      if (messages) {
        prompts = messages;
      } else {
        const text = this.getInput({ args }, callbacks);
        let userMessage: UserMessage;
        if (args.imageUrls) {
          userMessage = new UserMessage([
            {
              type: 'text',
              text,
            },
            ...args.imageUrls.map((url: string) => ({
              type: 'image_url',
              image_url: { url },
            }))
          ]);
        } else {
          userMessage = new UserMessage(text);
        }
        prompts = [userMessage];
      }
    }

    if (extraSystemPrompt) {
      if (context) {
        context.system_prompt += PARA_DELIM + extraSystemPrompt;
      } else {
        context = { system_prompt: extraSystemPrompt };
      }
    }

    if (this.inputGuardrails && this.inputGuardrails.length) {
      await this.inputGuardrails.call({ messages: prompts, callbacks });
    }

    if (returnTypeSchema && !functions) {
      const outputFormatter = new Func(
        'output_formatter',
        'Output formatter. Should always be used to format your response to the user.',
        returnTypeSchema
      );
      functions = [outputFormatter.toJSON()];
    }

    const request = {
      model: model.model,
      model_params: { modelParams, max_tokens: maxTokens },
      functions,
      prompt: {
        context,
        history: hist,
        messages: prompts,
      }
    };
    let { response, responseMetadata } = await this.model.call({
      provider: model.provider,
      request,
      callbacks,
    });
    if (enrichmentPipelineResponse?.responseMetadata) {
      const meta = enrichmentPipelineResponse.responseMetadata;
      costComponents.push(...(meta.costComponents || []));
      totalCost += meta.totalCost || 0;
      promptTokens += meta.promptTokens || 0;
      completionTokens += meta.completionTokens || 0;
      totalTokens += meta.totalTokens || 0;
    }
    if (responseMetadata) {
      costComponents.push(...(responseMetadata.costComponents || []));
      totalCost += responseMetadata.totalCost || 0;
      promptTokens += responseMetadata.promptTokens || 0;
      completionTokens += responseMetadata.completionTokens || 0;
      totalTokens += responseMetadata.totalTokens || 0;
    }

    responseMetadata = {
      ...responseMetadata,
      hist,
      prompts,
      totalCost,
      costComponents,
      promptTokens,
      completionTokens,
      totalTokens,
    };

    return { response, responseMetadata };
  }

  getContext(messages: Message[]) {
    const system_prompt = messages
      .filter(m => m.role === 'system')
      .map(m => m.content)
      .join(PARA_DELIM)
      ;
    return { system_prompt };
  }

  getImage(c: ImageContent) {
    return new Promise(async (resolve, reject) => {
      const url = c.image_url.url;
      try {
        const res = await axios.get(url, {
          responseType: 'stream',
          timeout: 5000,
        });
        const stream = res.data;
        const chunks = [];
        stream.on('data', (chunk) => {
          chunks.push(chunk);
        });
        stream.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const { width, height } = sizeOf(buffer);
          resolve({ width, height });
        })
        stream.on('error', () => {
          resolve({ width: 1024, height: 1024 });
        });
      } catch (err) {
        logger.error('Error getting image:', err);
        // logger.debug('options:', options);
        resolve({ width: 1024, height: 1024 });
      }
    });
  }

  getImages(messages: Message[]) {
    const proms = [];
    for (const msg of messages) {
      if (Array.isArray(msg.content)) {
        const content = msg.content as ContentObject[];
        for (const c of content) {
          if (c.type === 'image_url') {
            proms.push(this.getImage(c as ImageContent));
          }
        }
      }
    }
    return Promise.all(proms);
  }

  getInput({ args, isBatch, options }: GetInputParams, callbacks: Callback[]) {
    const content = getInput(args, isBatch, options);
    if (!content) {
      this.throwSemanticFunctionError('Cannot parse args', callbacks);
    }
    return content;
  }

  getNonSystemMessageHistory(history: Message[]) {
    return history.filter(nonSystem);
  }

  getNonSystemMessages(messages: Message[]) {
    return messages.filter(nonSystem);
  }

  async mapArgs(args: any, mappingTemplate: string, isBatch: boolean, callbacks: Callback[]) {
    try {
      const mapped = await this._mapArgs(args, mappingTemplate, isBatch);
      for (let callback of callbacks) {
        callback.onMapArguments({
          args,
          mapped,
          mappingTemplate,
          isBatch,
        });
      }
      return mapped;
    } catch (err) {
      for (let callback of callbacks) {
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

  async mapReturnType(response: any, mappingTemplate: string, isBatch: boolean, callbacks: Callback[]) {
    try {
      const mapped = await this._mapArgs(response, mappingTemplate, isBatch);
      for (let callback of callbacks) {
        callback.onMapReturnType({
          response,
          mapped,
          mappingTemplate,
          isBatch,
        });
      }
      return mapped;
    } catch (err) {
      for (let callback of callbacks) {
        callback.onMapReturnType({
          response,
          mappingTemplate,
          isBatch,
          errors: [{ message: String(err) }],
        });
      }
    }
  }

  onStart({ args, history, model, modelParams, isBatch, options }: SemanticFunctionImplementationCallParams, callbacks: Callback[]) {
    for (let callback of callbacks) {
      callback.onSemanticFunctionImplementationStart({
        args,
        history,
        modelType: this.model.modelType,
        model,
        modelParams,
        isBatch,
        options,
      });
    }
  }

  onEnd({ model, response, errors }: SemanticFunctionImplementationOnEndParams, callbacks: Callback[]) {
    for (let callback of callbacks) {
      callback.onSemanticFunctionImplementationEnd({
        model,
        response,
        errors,
      });
    }
  }

  onBatchBinStart(params, callbacks: Callback[]) {
    for (let callback of callbacks) {
      callback.onBatchBinStart(params);
    }
  }

  onBatchBinEnd({ errors }, callbacks: Callback[]) {
    for (let callback of callbacks) {
      callback.onBatchBinEnd({ errors });
    }
  }

  throwSemanticFunctionError(message: string, callbacks: Callback[]) {
    const errors = [{ message }];
    for (let callback of callbacks) {
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

const nonSystem = (m: Message) => m.role !== 'system';
