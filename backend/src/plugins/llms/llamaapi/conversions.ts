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
  OpenAIChatCompletionResponse,
} from '../../../core/models/openai_types';

export function toLlamaApiChatRequest(request: ChatRequest) {
  const {
    functions,
    function_call,
    stream,
  } = request;
  const messages = createOpenAIMessages(request.prompt);
  return {
    messages,
    functions,
    function_call,
    stream,
  };
}

export async function fromLlamaApiChatResponse(
  response: OpenAIChatCompletionResponse,
  parserService: ParserService,
) {
  const choice = response.choices[0];
  const text = choice.message.content as string;
  let choices: ChatCompletionChoice[];
  const { json, nonJsonStr } = await parserService.parse('json', text);
  if (json) {
    const { action, action_input, citations } = json;
    if (citations) {
      const content = nonJsonStr.replace(/\s*Citations:\s*/, PARA_DELIM).trim();
      choices = [
        {
          index: 0,
          finish_reason: choice.finish_reason,
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
            index: 0,
            finish_reason: choice.finish_reason,
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
            index: 0,
            finish_reason: choice.finish_reason,
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
    choices = response.choices;
  }
  return {
    id: uuid.v4(),
    created: new Date(),
    n: choices.length,
    choices: choices.map(c => ({
      finish_reason: c.finish_reason,
      index: c.index,
      message: {
        role: c.message.role,
        content: c.message.content,
        function_call: c.message.function_call,
      }
    })),
  };
}
