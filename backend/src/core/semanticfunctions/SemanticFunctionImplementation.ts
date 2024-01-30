// import http from 'http';
import axios from 'axios';
import relativeTime from 'dayjs/plugin/relativeTime';
import sizeOf from 'image-size';
// import url from 'url';
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
import { SemanticFunction } from './SemanticFunction';
import {
  SemanticFunctionImplementationParams,
  SemanticFunctionImplementationCallParams,
  SemanticFunctionImplementationOnEndParams,
} from './SemanticFunctionImplementation_types';

dayjs.extend(relativeTime);

const DEFAULT_CONTEXT_WINDOW = 4096;

const DEFAULT_MAX_TOKENS = 1024;

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
    messages,
    history,
    extraSystemPrompt,
    modelKey,
    modelParams,
    functions,
    isBatch,
    returnTypeSchema,
    options,
    callbacks = [],
  }: SemanticFunctionImplementationCallParams) {
    this.currentCallbacks = [...this.callbacks, ...callbacks];
    modelKey = modelKey || this.model.model;
    this.onStart({ args, messages, history, modelKey, modelParams, isBatch, options });
    if (!options) {
      options = {};
    }
    try {
      if (this.argsMappingTemplate) {
        args = await this.mapArgs(args, this.argsMappingTemplate, isBatch);
      }
      let response: any;
      let responseMetadata: Partial<ResponseMetadata>;

      if (this.model.modelType === 'gpt' || this.model.modelType === 'completion') {
        /********************************************
         ** GPT
         ********************************************/
        const contextWindow = (this.model as LLMModel).contextWindow || DEFAULT_CONTEXT_WINDOW;
        let maxTokens = +modelParams.max_tokens;
        if (isNaN(maxTokens)) {
          maxTokens = DEFAULT_MAX_TOKENS;
        }

        if (args && isBatch) {
          const maxTokensPerRequest = (this.model as LLMModel).contextWindow * 0.9;  // leave a little buffer
          const maxTokensPerChat = maxTokensPerRequest - maxTokens;
          const originalTexts = this.getInput(args, isBatch, options);
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
          const proms = bins.map(inputs => {
            let batchArgs: any;
            if (allProps) {
              batchArgs = inputs;
            } else {
              batchArgs = { text: inputs };
            }
            return this.runImplementation({
              args: batchArgs,
              extraSystemPrompt,
              history,
              messages,
              contextWindow,
              maxTokens,
              modelKey,
              modelParams,
              functions,
              returnTypeSchema,
              isBatch,
              callbacks,
            });
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
            maxTokens,
            modelKey,
            modelParams,
            functions,
            returnTypeSchema,
            isBatch,
            callbacks,
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

      return { response, responseMetadata };
    } catch (err) {
      const errors = err.errors || [{ message: String(err) }];
      this.onEnd({ errors });
      throw err;
    }
  }

  async runImplementation({
    args,
    extraSystemPrompt,
    history,
    messages,
    contextWindow,
    maxTokens,
    modelKey,
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
      logger.debug('rewriteQuery before:', content);
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
        logger.debug('rewriteQuery after:', args[this.indexContentPropertyPath]);
      }
    }

    if (this.promptEnrichmentPipeline) {
      enrichmentPipelineResponse = await this.promptEnrichmentPipeline.call({
        args,
        messages,
        contextWindow,
        maxTokens,
        modelKey,
        isBatch,
        callbacks,
      });
      const enrichedMessages = enrichmentPipelineResponse.messages;
      if (!enrichedMessages.length) {
        this.throwSemanticFunctionError('no prompt');
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
        const text = this.getInput(args);
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
      model: modelKey,
      model_params: modelParams,
      functions,
      prompt: {
        context,
        history: hist,
        messages: prompts,
      }
    };
    let { response, responseMetadata } = await this.model.call({ request, callbacks });
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
      // const options = url.parse((c as ImageContent).image_url.url);
      const url = c.image_url.url;
      try {
        // http.get(options, (res) => {
        //   const chunks = [];
        //   res
        //     .on('data', (chunk) => {
        //       chunks.push(chunk);
        //     })
        //     .on('end', () => {
        //       const buffer = Buffer.concat(chunks);
        //       const { width, height } = sizeOf(buffer);
        //       images.push({ width, height });
        //     })
        //     .on('error', () => {
        //       images.push({ width: 1024, height: 1024 });
        //     });
        // });
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

  getInput(args: any, isBatch?: boolean, options?: any) {
    const content = getInput(args, isBatch, options);
    if (!content) {
      this.throwSemanticFunctionError('Cannot parse args');
    }
    return content;
  }

  getNonSystemMessageHistory(history: Message[]) {
    return history.filter(nonSystem);
  }

  getNonSystemMessages(messages: Message[]) {
    return messages.filter(nonSystem);
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

  onStart({ args, history, modelKey, modelParams, isBatch, options }: SemanticFunctionImplementationCallParams) {
    for (let callback of this.currentCallbacks) {
      callback.onSemanticFunctionImplementationStart({
        args,
        history,
        modelType: this.model.modelType,
        modelKey,
        modelParams,
        isBatch,
        options,
      });
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

const nonSystem = (m: Message) => m.role !== 'system';
