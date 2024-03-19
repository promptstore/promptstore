import {
  PARA_DELIM,
  ChatCompletionChoice,
  ChatRequest,
  ParserService,
  MessageRole,
  createOpenAIMessages,
} from '../../../core/conversions';

import {
  CohereCompletionResponse,
} from './cohere_types';

export function toCohereLegacyChatRequest(request: ChatRequest) {
  const {
    model,
    model_params,
    stream,
  } = request;
  const {
    n,
    temperature,
    top_k,
    top_p = 0.75,
    stop,
    max_tokens,
    presence_penalty,
    frequency_penalty,
    logit_bias,
  } = model_params;
  const messages = createOpenAIMessages(request.prompt);
  const prompt = messages.map(m => m.content).join(PARA_DELIM);
  return {
    modelId: model,
    body: {
      prompt,
      // model,
      num_generations: n,
      stream,
      max_tokens,
      temperature,
      stop_sequences: stop?.length ? stop : undefined,
      k: top_k,
      p: Math.max(top_p, 0.99),

      // doesn't appear supported in Bedrock API - "ValidationException: Malformed input request: extraneous key [presence_penalty]"
      // frequency_penalty,
      // presence_penalty,

      logit_bias,
    }
  };
}

export async function fromCohereLegacyChatResponse(
  response: CohereCompletionResponse,
  parserService: ParserService,
) {
  const {
    id,
    prompt,
    generations,
    meta,
  } = response;
  const generation = generations[0];
  let choices: ChatCompletionChoice[];
  const { json, nonJsonStr } = await parserService.parse('json', generation.text);
  if (json) {
    const { action, action_input, citations } = json;
    if (citations) {
      const content = nonJsonStr.replace(/\s*Citations:\s*/, PARA_DELIM).trim();
      choices = [
        {
          index: generation.index,
          finish_reason: generation.finish_reason,
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
          logprobs: {
            tokens: generation.token_likelihoods?.map(t => t.token),
            token_logprobs: generation.token_likelihoods?.map(t => t.likelihood),
          },
        },
      ];
    } else if (action) {
      if (action === 'Final Answer') {
        choices = [
          {
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
    choices = generations.map(g => ({
      index: g.index,
      finish_reason: g.finish_reason,
      message: {
        role: MessageRole.assistant,
        content: g.text,
      },
      logprobs: {
        tokens: g.token_likelihoods?.map(t => t.token),
        token_logprobs: g.token_likelihoods?.map(t => t.likelihood),
      },
    }));
  }
  return {
    id,
    created: new Date(),
    model: meta?.api_version?.version,
    n: generations.length,
    choices,
  };
}
