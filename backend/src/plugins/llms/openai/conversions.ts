import uuid from 'uuid';

import {
  PARA_DELIM,
  ChatCompletionChoice,
  ChatRequest,
  Function,
  FunctionCallType,
  ParserService,
  Message,
  MessageRole,
  createOpenAIMessages,
  logger,
} from '../../../core/conversions';
import {
  getPromptTemplate as buildToolsPrompt,
} from '../../../core/conversions/prompt_template_variation_3';
import {
  OpenAIChatCompletionResponse,
  OpenAICompletionResponse,
  OpenAIImageResponse,
} from '../../../core/models/openai_types';

const OPENAI_MODELS_SUPPORTING_FUNCTIONS = [
  'gpt-4',
  'gpt-4o',
  'gpt-4o-2024-05-13',
  'gpt-4-1106-preview',
  'gpt-4-0125-preview',
  'gpt-4-0613',
  'gpt-3.5-turbo',
  'gpt-3.5-turbo-1106',
  'gpt-3.5-turbo-0613',
];

const OPENAI_MODELS_SUPPORTING_PARALLEL_FUNCTION_CALLING = [
  'gpt-4-1106-preview',
  'gpt-3.5-turbo-1106',
  'gpt-4o',
  'gpt-4o-2024-05-13',
];

export function toOpenAIChatRequest(request: ChatRequest) {
  const {
    model,
    model_params,
    stream,
    user,
  } = request;
  const {
    temperature,
    top_p,
    n,
    stop,
    max_tokens,
    presence_penalty,
    frequency_penalty,
    logit_bias,
  } = model_params;
  let functions: Function[];
  let function_call: FunctionCallType | object;
  let messages: Message[];
  if (OPENAI_MODELS_SUPPORTING_FUNCTIONS.includes(model)) {
    functions = request.functions;
    function_call = request.function_call;
    messages = createOpenAIMessages(request.prompt);
  } else {
    logger.debug('model "%s" doesn\'t support function calling', model);
    logger.debug('functions:', request.functions);
    messages = createOpenAIMessages(request.prompt, request.functions, buildToolsPrompt);
  }
  return {
    model,
    messages,
    functions,
    function_call,
    stream,
    user,
    temperature,
    top_p,
    n,
    stop,
    max_tokens,
    presence_penalty,
    frequency_penalty,
    logit_bias,
  };
}

export async function fromOpenAIChatResponse(
  response: OpenAIChatCompletionResponse,
  parserService: ParserService,
) {
  logger.debug('response:', response);
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

export function toOpenAICompletionRequest(request: ChatRequest) {
  const {
    functions,
    model,
    model_params,
    best_of,
    stream,
    user,
  } = request;
  const messages = createOpenAIMessages(request.prompt, functions);
  const prompt = messages.map(m => m.content).join(PARA_DELIM);
  const {
    temperature,
    top_p,
    n,
    stop,
    max_tokens,
    presence_penalty,
    frequency_penalty,
    logit_bias,
  } = model_params;
  return {
    model,
    prompt,
    stream,
    user,
    temperature,
    top_p,
    n,
    stop,
    max_tokens,
    presence_penalty,
    frequency_penalty,
    logit_bias,
    best_of,
  };
}

export async function fromOpenAICompletionResponse(
  response: OpenAICompletionResponse,
  parserService: ParserService,
) {
  const {
    id,
    created,
    model,
    usage,
  } = response;
  let choices: ChatCompletionChoice[];
  if (response.choices.length) {
    const { json } = await parserService.parse('json', response.choices[0].text);
    const { action, action_input } = json;
    if (action) {
      if (action === 'Final Answer') {
        choices = [
          {
            finish_reason: response.choices[0].finish_reason,
            index: 0,
            message: {
              role: MessageRole.assistant,
              content: action_input,
              final: true,
            },
            logprobs: response.choices[0].logprobs,
          }
        ];
      } else {
        choices = [
          {
            finish_reason: response.choices[0].finish_reason,
            index: 0,
            message: {
              role: MessageRole.function,
              content: null,
              function_call: {
                name: action,
                arguments: JSON.stringify(action_input),
              },
            },
            logprobs: response.choices[0].logprobs,
          }
        ];
      }
    } else {
      choices = response.choices.map(c => ({
        finish_reason: c.finish_reason,
        index: c.index,
        message: {
          role: MessageRole.assistant,
          content: c.text,
        },
        logprobs: c.logprobs,
      }));
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
  return {
    id,
    created,
    model,
    choices,
    n: choices.length,
    usage,
  };
}

export function toOpenAIImageRequest(request: ChatRequest) {
  const {
    model,
    model_params,
    user,
  } = request;
  const {
    n,
    quality,
    response_format,
    size,
    style,
    promptRewritingDisabled,
  } = model_params || {};
  let messages: Message[] = createOpenAIMessages(request.prompt);
  let prompt = messages.map(m => m.content).join(PARA_DELIM);
  if (promptRewritingDisabled) {
    prompt += PARA_DELIM + 'I NEED to test how the tool works with extremely simple prompts. DO NOT add any detail, just use it AS-IS:';
  }
  return {
    model,
    prompt,
    user,
    n,
    quality,
    response_format,
    size,
    style,
  };
}

export function fromOpenAIImageResponse(responses: OpenAIImageResponse[]) {
  const choices = responses.map(({ url, revised_prompt }, index) => ({
    index,
    message: {
      role: MessageRole.assistant,
      content: [
        {
          type: 'image_url',
          image_url: { url },
        },
      ],
    },
    revisedPrompt: revised_prompt,
  }));
  return {
    id: uuid.v4(),
    created: new Date(),
    n: choices.length,
    choices,
  };
}
