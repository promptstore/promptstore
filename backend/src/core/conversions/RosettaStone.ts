import type { Schema } from 'jsonschema';

import logger from '../../logger';

import {
  OpenAIMessageImpl,
  UserMessage,
  AssistantMessage,
  SystemMessage,
  FunctionMessage,
} from '../models/openai';
import {
  OpenAIMessage,
  OpenAIChatCompletionResponse,
} from '../models/openai_types';
import {
  ParserService,
} from '../outputprocessing/OutputProcessingPipeline_types';
import { SchemishConverter } from './Schemish';

// TODO get prompts from store
import {
  getPromptTemplate,
} from './prompt_template_variation_1';

export const PARA_DELIM = '\n\n';

const OPENAI_MODELS_SUPPORTING_FUNCTIONS = [
  'gpt-4',
  'gpt-4-1106-preview',
  'gpt-4-0125-preview',
  'gpt-4-0613',
  'gpt-3.5-turbo',
  'gpt-3.5-turbo-1106',
  'gpt-3.5-turbo-0613',
];

/*** universal superset ************/

interface CitationSource {
  start_index: number;  // Start of segment of the response that is attributed to this source. Index indicates the start of the segment, measured in bytes.
  end_index: number;  // End of the attributed segment, exclusive.
  uri: string;  // URI that is attributed as a source for a portion of the text.
  license_: string;  // License for the GitHub project that is attributed as a source for segment.  License info is required for code citations.
  dataSourceId: number;
  dataSourceName: string;
  page: number;
  row: number;
}

export interface CitationMetadata {
  citation_sources: Partial<CitationSource>[];
}

interface ContextChunk {
  content: string;
  author?: string;
  citation_metadata?: CitationMetadata;
}

interface AdditionalContext {
  content: string;
  chunks: ContextChunk[];
}

export interface ChatRequestContext {
  system_prompt: ContentType;
  additional_context?: Partial<AdditionalContext>;
}

export enum MessageRole {
  system = 'system',
  user = 'user',
  assistant = 'assistant',
  function = 'function',
  tool = 'tool',
}

export interface FunctionCall {
  name: string;  // The name of the function to call.
  arguments: any;  // The arguments to call the function with, as generated by the model in JSON format. Note that the model does not always generate valid JSON, and may hallucinate parameters not defined by your function schema.
}

export interface TextContent {
  type: string;
  text: string;
}

interface ImageURL {
  url: string;  // Either a URL of the image or the base64 encoded image data.
  detail?: string;  // Specifies the detail level of the image. Defaults to auto
}

export interface ImageContent {
  type: string;
  image_url: ImageURL;
  objectName?: string;
}

export type ContentObject = TextContent | ImageContent;

export type ContentType = string | string[] | ContentObject[];

export interface Message<T = ContentType> {
  role: MessageRole;
  content: T;
  name?: string;
  function_call?: FunctionCall;
  citation_metadata?: CitationMetadata;
  final?: boolean;
}

interface FewShotLearningExample {
  input: Message;
  output: Message;
}

export interface ChatPrompt {
  context?: ChatRequestContext;
  examples?: FewShotLearningExample[];
  history?: Message[];
  messages: Message[];
}

export interface ModelObject {
  model: string;
  provider: string;
}

interface ResponseFormat {
  type: string;
}

export interface ModelParams {
  max_tokens: number;  // The maximum number of tokens to generate in the chat completion. The total length of input tokens and generated tokens is limited by the model's context length. Defaults to inf.
  n: number;  // How many chat completion choices to generate for each input message. Defaults to 1.
  temperature: number;  // What sampling temperature to use, between 0 and 2. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic. Defaults to 1. Alter this or top_p but not both.
  top_p: number;  // An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered. Defaults to 1. Alter this or temperature but not both.
  stop: string | string[];  // Up to 4 sequences where the API will stop generating further tokens. Defaults to null.
  presence_penalty: number;  // Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics. Defaults to 0.
  frequency_penalty: number;  // Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim. Defaults to 0.
  logit_bias: object;  // Modify the likelihood of specified tokens appearing in the completion. Accepts a json object that maps tokens (specified by their token ID in the tokenizer) to an associated bias value from -100 to 100. Mathematically, the bias is added to the logits generated by the model prior to sampling. The exact effect will vary per model, but values between -1 and 1 should decrease or increase likelihood of selection; values like -100 or 100 should result in a ban or exclusive selection of the relevant token. Defaults to null.
  seed: number;
  response_format: string | ResponseFormat;
  quality: string;
  size: string;
  style: string;
  aspect_ratio: string;  // The aspect ratio of the generated image.
  negative_prompt: string;  // A blurb of text describing what you do not wish to see in the output image.
  output_format: string;  // Dictates the content-type of the generated image.
  cfg_scale: number;  // Determines how much the final image portrays the prompt. Use a lower number to increase randomness in the generation. Min 0, Max 35, Default 7
  clip_guidance_preset: string;  // Enum: FAST_BLUE, FAST_GREEN, NONE, SIMPLE SLOW, SLOWER, SLOWEST.
  sampler: string;  // The sampler to use for the diffusion process. If this value is omitted, the model automatically selects an appropriate sampler for you. Enum: DDIM, DDPM, K_DPMPP_2M, K_DPMPP_2S_ANCESTRAL, K_DPM_2, K_DPM_2_ANCESTRAL, K_EULER, K_EULER_ANCESTRAL, K_HEUN K_LMS.
  samples: number;  // The number of image to generate. Currently Amazon Bedrock supports generating one image. If you supply a value for samples, the value must be one. Min 1, Max 1, Default 1
  steps: number;  // Generation step determines how many times the image is sampled. More steps can result in a more accurate result. Min 10, Max 50, Default 30  
  style_preset: number;  // A style preset that guides the image model towards a particular style. This list of style presets is subject to change. Enum: 3d-model, analog-film, anime, cinematic, comic-book, digital-art, enhance, fantasy-art, isometric, line-art, low-poly, modeling-compound, neon-punk, origami, photographic, pixel-art, tile-texture
  extras: any;  // Extra parameters passed to the engine. Use with caution. These parameters are used for in-development or experimental features and might change without warning.
  promptRewritingDisabled: boolean;
}

interface ChatModelParams extends ModelParams {
  top_k: number;
}

export interface Function {
  name: string;  // The name of the function to be called. Must be a-z, A-Z, 0-9, or contain underscores and dashes, with a maximum length of 64.
  description?: string;  // A description of what the function does, used by the model to choose when and how to call the function.
  parameters: Schema;  // JSONSchema document that describes the function and arguments.
}

export enum FunctionCallType {
  none = 'none',  // "none" means the model does not call a function, and responds to the end-user.
  auto = 'auto',  // "auto" means the model can pick between an end-user or calling a function.
}

enum HarmBlockThreshold {
  HARM_BLOCK_THRESHOLD_UNSPECIFIED = 0,
  BLOCK_LOW_AND_ABOVE = 1,
  BLOCK_MEDIUM_AND_ABOVE = 2,
  BLOCK_ONLY_HIGH = 3,
  BLOCK_NONE = 4,
}

export interface SafetySetting {
  category: string;  // The category for this setting.
  threshold: HarmBlockThreshold;  // Controls the probability threshold at which harm is blocked.
}

export interface ChatRequest {
  model: string;
  prompt: ChatPrompt;
  model_params?: Partial<ChatModelParams>;
  functions?: Function[];  // A list of functions the model may generate JSON inputs for.
  function_call?: FunctionCallType | object;
  best_of?: number;
  stream?: boolean;
  user?: string;
  safety_settings?: SafetySetting[];
  safe_mode?: boolean;
  random_seed?: number;
}

export interface SafetyRating {
  category: string;
  probability: string;
}

export interface LogProbs {
  text_offset?: number[];
  token_logprobs: number[];
  tokens: string[];
  top_logprobs?: Record<string, number>[];
}

export interface ChatCompletionChoice {
  finish_reason?: string;
  index: number;
  message: Message;
  safety_ratings?: SafetyRating[];  // Ratings for the safety of a response. There is at most one rating per category.
  logprobs?: LogProbs;
  revised_prompt?: string;
}

export interface ChatCompletionUsage {
  completion_tokens: number;
  prompt_tokens: number;
  total_tokens: number;
}

enum BlockedReason {
  BLOCKED_REASON_UNSPECIFIED = 0,
  SAFETY = 1,
  OTHER = 2,
}

export interface ContentFilter {
  reason: BlockedReason;
  message: string;
}

export interface SafetyFeedback {
  rating: SafetyRating;  // Safety rating evaluated from content.
  setting: SafetySetting;  // Safety setting applied to the request.
}

export interface ChatResponse {
  id: string;
  created: Date;
  model?: string;
  choices: ChatCompletionChoice[];
  usage?: ChatCompletionUsage;
  n: number;
  filters?: ContentFilter[];
  safetyFeedback?: SafetyFeedback[];
}

export interface ImageMetadata {
  quality: string;
  width: number;
  height: number;
}

interface SystemInput {
  args?: any;
  messages?: Message[];
  history?: Message[];
  extraSystemPrompt?: string;
}

export interface ResponseMetadata {
  provider: string;
  functionId: number;
  functionName: string;
  prompts: Message[];
  images: ImageMetadata[];
  costComponents: Array<any>;
  totalCost: number;
  creditBalance: number;
  modelInput: any;
  modelUserInputText: string;
  systemInput: SystemInput;
  outputType: string;
  systemOutput: Message;
  systemOutputText: string;
  modelOutput: Message;
  modelOutputText: string;
  implementation: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface EmbeddingRequest {
  model?: string;  // ID of the model to use. 
  input: string | string[];  // Input text to embed, encoded as a string or array of tokens. To embed multiple inputs in a single request, pass an array of strings or array of token arrays. Each input must not exceed the max input tokens for the model (8191 tokens for text-embedding-ada-002).
  user?: string;  // A unique identifier representing your end-user, which can help OpenAI to monitor and detect abuse.
  inputType?: string;  // Specifies the type of input passed to the model. One of ['search_document', 'search_query', 'classification', 'clustering']
}

export interface EmbeddingObject {
  index: number;  // The index of the embedding in the list of embeddings.
  object: string;  // The object type, which is always "embedding".
  embedding: number[];  // The embedding vector, which is a list of floats. The length of vector depends on the model.
}

export interface EmbeddingUsage {
  prompt_tokens: number;
  total_tokens: number;
}

export interface EmbeddingResponse {
  object: string;  // The object type, which is always "list".
  data: EmbeddingObject[];
  model: string;
  usage: EmbeddingUsage;
}

type ToolsPromptBuilder = (toolDefinitions: string, toolKeys: string) => string[];

/*** ************/

/*** translate to openai ************/

export async function fromOpenAIChatResponse(
  response: OpenAIChatCompletionResponse,
  parserService: ParserService,
) {
  const {
    id,
    created,
    model,
    usage,
  } = response;
  let choices: ChatCompletionChoice[];
  if (OPENAI_MODELS_SUPPORTING_FUNCTIONS.includes(model)) {
    const candidates = response.choices;
    if (candidates.length) {
      const candidate = candidates[0];
      const message = candidate.message;
      const text = message.content as string;
      const { json, nonJsonStr } = await parserService.parse('json', text);
      if (json) {
        const { citations } = json;
        if (citations) {
          const content = nonJsonStr.replace(/\s*Citations:\s*/, PARA_DELIM).trim();
          choices = [
            {
              finish_reason: candidate.finish_reason,
              index: candidate.index,
              message: {
                role: MessageRole.assistant,
                content,
                name: message.name,
                citation_metadata: {
                  citation_sources: citations.map((cit: any) => ({
                    uri: cit.source,
                    page: cit.page,
                    row: cit.row,
                    dataSourceId: cit.dataSourceId,
                    dataSourceName: cit.dataSourceName,
                  })),
                }
              }
            }
          ];
        }
      }
    }
    if (!choices) {
      choices = response.choices.map(c => ({
        finish_reason: c.finish_reason,
        index: c.index,
        message: {
          role: c.message.role,
          content: c.message.content,
          name: c.message.name,
          function_call: c.message.function_call,
        }
      }));
    }
  } else {
    const candidates = response.choices;
    if (candidates.length) {
      const candidate = candidates[0];
      const message = candidate.message;
      const text = message.content as string;
      const { json, nonJsonStr } = await parserService.parse('json', text);
      const { action, action_input, citations } = json;
      if (action) {
        if (action === 'Final Answer') {
          choices = [
            {
              finish_reason: candidate.finish_reason,
              index: candidate.index,
              message: {
                role: MessageRole.assistant,
                content: action_input,
                name: message.name,
                citation_metadata: message.citation_metadata,
                final: true,
              },
            }
          ];
        } else {
          choices = [
            {
              finish_reason: candidate.finish_reason,
              index: candidate.index,
              message: {
                role: MessageRole.function,
                content: null,
                name: message.name,
                function_call: {
                  name: action,
                  arguments: JSON.stringify(action_input),
                },
                citation_metadata: message.citation_metadata,
              }
            }
          ];
        }
      } else if (citations) {
        const content = nonJsonStr.replace(/\s*Citations:\s*/, PARA_DELIM).trim();
        choices = [
          {
            finish_reason: candidate.finish_reason,
            index: candidate.index,
            message: {
              role: MessageRole.assistant,
              content,
              name: message.name,
              citation_metadata: {
                citation_sources: citations.map((cit: any) => ({
                  uri: cit.source,
                  page: cit.page,
                  row: cit.row,
                  dataSourceId: cit.dataSourceId,
                  dataSourceName: cit.dataSourceName,
                })),
              }
            }
          }
        ];
      } else {
        choices = response.choices.map(c => ({
          finish_reason: c.finish_reason,
          index: c.index,
          message: {
            role: c.message.role,
            content: c.message.content,
            name: c.message.name,
            function_call: c.message.function_call,
            citation_metadata: message.citation_metadata,
          }
        }))
      }
    } else {
      choices = [
        {
          index: 0,
          message: {
            role: MessageRole.assistant,
            content: 'No response from model',
            final: true,
          },
        }
      ];
    }
  }
  return {
    id,
    created,
    model,
    n: choices.length,
    choices,
    usage,
  };
}

/*** ************/

/*** utility ************/

export function createOpenAIMessages(
  prompt: ChatPrompt,
  functions?: Function[],
  toolsPromptBuilder?: ToolsPromptBuilder
) {
  const systemMessages: OpenAIMessage[] = [];
  const messages: OpenAIMessage[] = [];
  if (prompt.history) {
    for (const message of prompt.history) {
      if (message.role === 'system') {
        systemMessages.push(new OpenAIMessageImpl(message));
      } else if (message.role === 'function') {
        messages.push(new FunctionMessage(makeObservation(message.content), message.name));
      } else {
        messages.push(new OpenAIMessageImpl(message));
      }
    }
  }
  if (prompt.examples) {
    for (const { input, output } of prompt.examples) {
      messages.push(new UserMessage(input.content));
      messages.push(new AssistantMessage(output.content as string));
    }
  }
  for (const message of prompt.messages) {
    if (message.role === 'system') {
      systemMessages.push(new OpenAIMessageImpl(message));
    } else if (message.role === 'function') {
      messages.push(new FunctionMessage(makeObservation(message.content), message.name));
    } else {
      messages.push(new OpenAIMessageImpl(message));
    }
  }
  const systemPrompt = createSystemPrompt(
    prompt.context,
    systemMessages as SystemMessage[],
    functions,
    toolsPromptBuilder
  );
  logger.debug('systemPrompt:', systemPrompt);
  if (systemPrompt) {
    const isObjectArray = systemPrompt.length && (systemPrompt[0] as any).type;
    if (isObjectArray) {
      return [new SystemMessage(systemPrompt), ...messages];
    }
    return [new SystemMessage(systemPrompt.join(PARA_DELIM)), ...messages];
  }
  return messages;
}

function getContextPrompt(context: ChatRequestContext) {
  let systemPrompt: string[] | ContentObject[] = [];
  if (context.system_prompt) {
    if (typeof context.system_prompt === 'string') {
      systemPrompt = [context.system_prompt];
    } else {
      systemPrompt = context.system_prompt;
    }
  }
  const isObjectArray = systemPrompt.length && (systemPrompt[0] as any).type;
  if (context.additional_context) {
    const { content, chunks = [] } = context.additional_context;
    if (content) {
      if (isObjectArray) {
        (systemPrompt as ContentObject[]).push({ type: 'text', text: content });
      } else {
        (systemPrompt as string[]).push(content);
      }
    }
    for (const chunk of chunks) {
      let ctx = chunk.content;
      if (chunk.citation_metadata) {
        const sources = chunk.citation_metadata.citation_sources.map(s => s.uri);
        ctx += ` Sources: [${sources.join(', ')}]`;
      }
      if (isObjectArray) {
        (systemPrompt as ContentObject[]).push({ type: 'text', text: ctx });
      } else {
        (systemPrompt as string[]).push(ctx);
      }
    }
  }
  return systemPrompt;
}

export function getToolDefinitions(functions: Function[]) {
  const d: string[] = [];
  for (const f of functions) {
    try {
      const schema = new SchemishConverter(f.parameters);
      const args = schema.convert();
      d.push(`${f.name}: ${f.description}, args: ${args}`);
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      logger.error(message);
      d.push(`${f.name}: ${f.description}, args: ${JSON.stringify(f.parameters)}`);
    }
  }
  return d.join('\n');
}

export function getFunctionPrompts(functions: Function[], toolsPromptBuilder?: ToolsPromptBuilder) {
  if (!toolsPromptBuilder) {
    // get default
    toolsPromptBuilder = getPromptTemplate;
  }
  const toolDefinitions = getToolDefinitions(functions);
  const toolKeys = functions.map(f => f.name).join(', ');
  return toolsPromptBuilder(toolDefinitions, toolKeys);
}

export function createSystemPrompt(
  context: ChatRequestContext,
  systemMessages: SystemMessage[],
  functions?: Function[],
  toolsPromptBuilder?: ToolsPromptBuilder
) {
  let isObjectArray = false;
  let systemPrompt: string[] | ContentObject[] = [];
  if (context) {
    systemPrompt = getContextPrompt(context);
  }
  isObjectArray = systemPrompt.length && (systemPrompt[0] as any).type;
  if (systemMessages?.length) {
    if (isObjectArray) {
      for (const m of systemMessages) {
        if (Array.isArray(m.content)) {
          for (const c of m.content) {
            if ((c as any).type) {
              (systemPrompt as ContentObject[]).push(c as ContentObject);
            } else {
              (systemPrompt as ContentObject[]).push({ type: 'text', text: c as string });
            }
          }
        } else {
          (systemPrompt as ContentObject[]).push({ type: 'text', text: m.content });
        }
      }
    } else {
      if (systemMessages.some(m => Array.isArray(m.content) && m.content.length && (m.content as any).type)) {
        // at least one of the systemMessages is a ContentObject, so
        // convert systemPrompt to ContentObject[]
        systemPrompt = [
          {
            type: 'text',
            text: systemPrompt.join(PARA_DELIM),
          }
        ];
        isObjectArray = true;
        for (const m of systemMessages) {
          if (Array.isArray(m.content)) {
            for (const c of m.content) {
              if ((c as any).type) {
                (systemPrompt as ContentObject[]).push(c as ContentObject);
              } else {
                (systemPrompt as ContentObject[]).push({ type: 'text', text: c as string });
              }
            }
          } else {
            (systemPrompt as ContentObject[]).push({ type: 'text', text: m.content });
          }
        }
      } else {
        for (const m of systemMessages) {
          if (Array.isArray(m.content)) {
            (systemPrompt as string[]).push(...m.content as string[])
          } else {
            (systemPrompt as string[]).push(m.content);
          }
        }
      }
    }
  }
  if (functions?.length) {
    const prompts = getFunctionPrompts(functions, toolsPromptBuilder);
    if (isObjectArray) {
      (systemPrompt as ContentObject[]).push({
        type: 'text',
        text: prompts.join(PARA_DELIM),
      });
    } else {
      (systemPrompt as string[]).push(...prompts);
    }
  }
  return systemPrompt;
}

export function fillContent(templateFiller: any, args: any, content: ContentType) {
  if (typeof content === 'string') {
    return templateFiller(content, args);
  }
  if (Array.isArray(content) && content.length) {
    if (typeof content[0] === 'string') {
      return (content as string[]).map(c => templateFiller(c, args));
    }
    return (content as ContentObject[]).map(c => {
      if (c.type === 'text') {
        return { ...c, text: templateFiller((c as TextContent).text, args) };
      }
      return c;
    });
  }
  return content;
}

/**
 * @param content 
 * @returns 
 */
export function convertContentTypeToString(content: ContentType) {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content) && content.length) {
    if (typeof content[0] === 'string') {
      return (content as string[]).join(PARA_DELIM);
    }
    return (content as ContentObject[])
      .filter(c => c.type === 'text')
      .map((c: TextContent) => c.text)
      .join(PARA_DELIM);
  }
  return '';
}

function makeObservation(observation: ContentType) {
  return convertContentTypeToString(observation);
  // return 'Observation: ' + observation + '\nThought: ';
}

export function getText(messages: Message[]) {
  return messages
    .map(m => convertContentTypeToString(m.content))
    .join(PARA_DELIM);
}

/*** ************/
