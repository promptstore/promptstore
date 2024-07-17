import {
  PARA_DELIM,
  ChatCompletionChoice,
  ChatRequest,
  ParserService,
  MessageRole,
  createOpenAIMessages,
} from '../../../core/conversions';

import {
  AI21CompletionResponse,
  AI21PenaltyObject,
} from './ai21_types';

// TODO use Chat API
export function toAI21ChatRequest(request: ChatRequest) {
  const {
    model,
    model_params,
  } = request;
  // const modelKey = getModelKey(model);
  const {
    n,
    temperature,
    top_k,
    top_p,
    stop = [],
    max_tokens,
    presence_penalty,
    frequency_penalty,
  } = model_params;
  const messages = createOpenAIMessages(request.prompt);
  const prompt =
    PARA_DELIM + 'Human: ' +
    messages.map(m => m.content).join(PARA_DELIM) + PARA_DELIM +
    'Assistant:'
    ;
  const stopSequences = ['\\n\\nHuman:', ...stop];
  let frequencyPenalty: AI21PenaltyObject;
  if (frequency_penalty) {
    frequencyPenalty = { scale: frequency_penalty };
  }
  let presencePenalty: AI21PenaltyObject;
  if (presence_penalty) {
    frequencyPenalty = { scale: presence_penalty };
  }
  return {
    modelId: model,
    body: {
      prompt,
      maxTokens: max_tokens,
      numResults: n,
      temperature,
      topP: top_p,
      stopSequences,
      topKReturn: top_k,
      frequencyPenalty,
      presencePenalty,
    }
  };
}

export async function fromAI21ChatResponse(
  response: AI21CompletionResponse,
  parserService: ParserService,
) {
  const {
    id,
    prompt,
    completions,
  } = response;
  let choices: ChatCompletionChoice[];

  const { data, finishReason } = completions[0];
  const { json, nonJsonStr } = await parserService.parse('json', data.text);
  if (json) {
    const { action, action_input, citations } = json;
    if (citations) {
      const content = nonJsonStr.replace(/\s*Citations:\s*/, PARA_DELIM).trim();
      choices = [
        {
          index: 0,
          finish_reason: finishReason.reason,
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
            finish_reason: finishReason.reason,
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
            finish_reason: finishReason.reason,
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
        finish_reason: finishReason.reason,
        index: 0,
        message: {
          role: MessageRole.assistant,
          content: data.text,
        },
      }
    ];
  }
  const prompt_tokens = prompt.tokens.length;
  const completion_tokens = completions.reduce((a, c) => a + c.data.tokens.length, 0);
  const total_tokens = prompt_tokens + completion_tokens;
  return {
    id,
    created: new Date(),
    n: choices.length,
    choices,
    usage: {
      prompt_tokens,
      completion_tokens,
      total_tokens,
    },
  };
}

function getModelKey(model: string) {
  if (model.includes('light')) {
    return 'light';
  }
  if (model.includes('ultra')) {
    return 'ultra';
  }
  return 'mid';
}
