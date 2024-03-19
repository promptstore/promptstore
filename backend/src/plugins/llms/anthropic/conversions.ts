import {
  PARA_DELIM,
  ChatCompletionChoice,
  ChatPrompt,
  ChatRequest,
  ContentObject,
  Function,
  ImageContent,
  ParserService,
  Message,
  MessageRole,
  TextContent,
  convertContentTypeToString,
  convertImageToBase64Only,
  getFunctionPrompts,
  getMimetype,
} from '../../../core/conversions';

import {
  AnthropicV1ChatCompletionResponse,
  AnthropicV1ContentObject,
} from './anthropic_types';

async function mapAnthropicV1Message(message: Message) {
  let content: AnthropicV1ContentObject[];
  if (typeof message.content === 'string') {
    content = [{ type: 'text', text: message.content }];
  } else if (Array.isArray(message.content)) {
    content = [];
    let c: string | ContentObject;
    for (c of message.content) {
      if (typeof c === 'string') {
        content.push({ type: 'text', text: c });
        continue;
      }
      if (c.type === 'text') {
        const textContent = c as TextContent;
        content.push(textContent);
        continue;
      }
      if (c.type === 'image_url') {
        const imageContent = c as ImageContent;
        const imageUrl = imageContent.image_url.url;
        const { pathname } = new URL(imageUrl);
        const filename = pathname.split('/').pop();
        const media_type = getMimetype(filename);
        const data = await convertImageToBase64Only(imageUrl) as string;
        const source = {
          type: 'base64',
          media_type,
          data,
        };
        content.push({ type: 'image', source });
      }
    }
  }
  return {
    role: message.role,
    content,
  };
}

async function createAnthropicV1Prompts(prompt: ChatPrompt, functions?: Function[]) {
  const messages = [];
  const systemPrompts = [];
  if (prompt.history) {
    for (const message of prompt.history) {
      if (message.role === 'system') {
        systemPrompts.push(convertContentTypeToString(message.content));
        continue;
      }
      if (message.role !== 'function') {
        messages.push(mapAnthropicV1Message(message));
      }
    }
  }
  if (prompt.examples) {
    for (const { input, output } of prompt.examples) {
      messages.push({
        role: 'user',
        content: input.content,
      });
      messages.push({
        role: 'assistant',
        content: output.content,
      });
    }
  }
  for (const message of prompt.messages) {
    if (message.role === 'system') {
      systemPrompts.push(convertContentTypeToString(message.content));
      continue;
    }
    if (message.role !== 'function') {
      const msg = await mapAnthropicV1Message(message);
      messages.push(msg);
    }
  }
  if (functions?.length) {
    systemPrompts.push(...getFunctionPrompts(functions));
  }
  return {
    system: systemPrompts.join(PARA_DELIM),
    messages,
  };
}

export async function toAnthropicV1ChatRequest(request: ChatRequest) {
  const {
    functions,
    model,
    model_params,
    prompt,
    stream,
    user,
  } = request;
  const {
    temperature,
    top_k,
    top_p,
    stop = [],
    max_tokens,
  } = model_params;
  const { system, messages } = await createAnthropicV1Prompts(prompt, functions);
  return {
    model,
    messages,
    system,
    max_tokens,
    metadata: { user_id: user },
    temperature,
    stop_sequences: stop,
    stream,
    top_p,
    top_k,
  };
}

export async function fromAnthropicV1ChatResponse(
  response: AnthropicV1ChatCompletionResponse,
  parserService: ParserService,
) {
  const {
    content,
    id,
    model,
    stop_reason,
    stop_sequence,
    usage,
  } = response;
  let choices: ChatCompletionChoice[];

  const { json, nonJsonStr } = await parserService.parse('json', content[0].text);
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
          content: content[0].text,
        },
      }
    ];
  }
  const completion_tokens = usage?.output_tokens || 0;
  const prompt_tokens = usage?.input_tokens || 0;
  return {
    id,
    created: new Date(),
    model,
    n: choices.length,
    choices,
    usage: {
      completion_tokens,
      prompt_tokens,
      total_tokens: prompt_tokens + completion_tokens,
    }
  };
}
