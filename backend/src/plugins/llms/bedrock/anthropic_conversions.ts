import uuid from 'uuid';

import {
  PARA_DELIM,
  ChatCompletionChoice,
  ChatRequest,
  ParserService,
  MessageRole,
  createOpenAIMessages,
} from '../../../core/conversions';

import {
  AnthropicChatCompletionResponse,
} from './anthropic_types';

export function toAnthropicChatRequest(request: ChatRequest) {
  const {
    model,
    model_params,
    stream,
  } = request;
  const {
    temperature,
    top_k,
    top_p,
    stop = [],
    max_tokens,
  } = model_params;
  const messages = createOpenAIMessages(request.prompt);
  const prompt =
    PARA_DELIM + 'Human: ' +
    messages.map(m => m.content).join(PARA_DELIM) + PARA_DELIM +
    'Assistant:'
    ;
  const stop_sequences = ['\\n\\nHuman:', ...stop];
  return {
    modelId: model,
    body: {
      prompt,
      max_tokens_to_sample: max_tokens,
      temperature,
      top_k,
      top_p,
      stop_sequences,
      stream,
    }
  };
}

export async function fromAnthropicChatResponse(
  response: AnthropicChatCompletionResponse,
  parserService: ParserService,
) {
  const {
    completion,
    stop_reason,
    model,
  } = response;
  let choices: ChatCompletionChoice[];

  const { json, nonJsonStr } = await parserService.parse('json', completion);
  if (json) {
    const { action, action_input, citations } = json;
    if (citations) {
      const content = nonJsonStr.replace(/\s*Citations:\s*/, PARA_DELIM).trim();
      choices = [
        {
          index: 0,
          finish_reason: stop_reason,
          message: {
            role: MessageRole.assistant,
            content,
            citation_metadata: {
              citation_sources: citations.map((cit: any) => ({
                uri: cit.source,
                page: cit.page,
                row: cit.row,
                dataSourceId: cit.dataSourceId,
                dataSourceName: cit.dataSourceName,
              })),
            },
          },
        },
      ];
    } else if (action) {
      if (action === 'Final Answer') {
        choices = [
          {
            finish_reason: stop_reason,
            index: 0,
            message: {
              role: MessageRole.assistant,
              content: action_input,
              final: true,
            },
          }
        ];
      } else {
        const args = { input: action_input };
        choices = [
          {
            finish_reason: stop_reason,
            index: 0,
            message: {
              role: MessageRole.function,
              content: null,
              function_call: {
                name: action,
                arguments: JSON.stringify(args),
              },
            },
          }
        ];
      }
    }
  }
  if (!choices) {
    choices = [
      {
        finish_reason: stop_reason,
        index: 0,
        message: {
          role: MessageRole.assistant,
          content: completion,
        },
      }
    ];
  }
  return {
    id: uuid.v4(),
    created: new Date(),
    model,
    n: choices.length,
    choices,
  };
}
