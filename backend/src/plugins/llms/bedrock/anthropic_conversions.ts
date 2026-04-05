import uuid from 'uuid';

import {
  PARA_DELIM,
  ChatCompletionChoice,
  ChatRequest,
  ParserService,
  MessageRole,
  createOpenAIMessages,
  convertContentTypeToString,
} from '../../../core/conversions';

import {
  AnthropicChatCompletionResponse,
  AnthropicRequestBody,
  AnthropicCompletionsRequest,
  AnthropicMessagesRequest,
} from './anthropic_types';

export function toAnthropicChatRequest(request: ChatRequest): { modelId: string; body: AnthropicRequestBody } {
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
  
  // Check if this is a Claude 3+ model (requires Messages API)
  if (model.includes('claude-3') || model.includes('haiku-3') || model.includes('sonnet-3') || model.includes('opus-3')) {
    // Extract system prompt (if any)
    const systemText = messages
      .filter(m => m.role === 'system')
      .map(m => convertContentTypeToString(m.content))
      .join(PARA_DELIM);

    // Filter out system messages and ensure first message is user
    const filteredMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: convertContentTypeToString(m.content)
      }));
    
    // Ensure we have at least one user message
    if (filteredMessages.length === 0 || filteredMessages[0].role !== 'user') {
      // If no messages or first message isn't user, create a default user message
      filteredMessages.unshift({
        role: 'user',
        content: 'Please help me.'
      });
    }
    
    const messagesBody: AnthropicMessagesRequest = {
      messages: filteredMessages,
      max_tokens,
      temperature,
      top_k,
      top_p,
      stop_sequences: Array.isArray(stop) ? stop : [stop],
      anthropic_version: 'bedrock-2023-05-31'
    };

    if (systemText && systemText.trim().length > 0) {
      messagesBody.system = systemText;
    }
    
    return {
      modelId: model,
      body: messagesBody
    };
  }
  
  // Legacy Claude models use the old prompt format
  const prompt =
    PARA_DELIM + 'Human: ' +
    messages.map(m => convertContentTypeToString(m.content)).join(PARA_DELIM) + PARA_DELIM +
    'Assistant:'
    ;
  const stop_sequences = ['\\n\\nHuman:', ...(Array.isArray(stop) ? stop : [stop])];
  
  const completionsBody: AnthropicCompletionsRequest = {
    model,
    prompt,
    max_tokens_to_sample: max_tokens,
    temperature,
    top_k,
    top_p,
    stop_sequences,
    stream,
  };
  
  return {
    modelId: model,
    body: completionsBody
  };
}

export async function fromAnthropicChatResponse(
  response: AnthropicChatCompletionResponse,
  parserService: ParserService,
) {
  // Handle both old completion format and new content format
  let completion: string;
  let stop_reason: string;
  let model: string;
  
  // Check if this is a Messages API response (Claude 3+)
  if ('content' in response && response.content && response.content.length > 0) {
    // Handle content array format from Messages API
    const contentBlock = response.content[0];
    completion = (contentBlock && typeof contentBlock === 'object' && 'text' in contentBlock) 
      ? contentBlock.text || '' 
      : (typeof contentBlock === 'string' ? contentBlock : '');
    stop_reason = response.stop_reason;
    model = response.model;
  } else if ('completion' in response) {
    // Legacy Completions API response (Claude 1, 2)
    completion = response.completion || '';
    stop_reason = response.stop_reason;
    model = response.model;
  } else {
    // Fallback
    completion = '';
    stop_reason = 'max_tokens';
    model = 'unknown';
  }
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
