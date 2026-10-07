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
  AnthropicV1ChatCompletionRequest,
  AnthropicV1ChatCompletionResponse,
  AnthropicV1ContentObject,
  AnthropicV1Message,
  AnthropicV1ToolResultContent,
  AnthropicV1ToolUseContent,
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

function parseToolArguments(args: string | object) {
  if (typeof args !== 'string') return args || {};
  try {
    return JSON.parse(args || '{}');
  } catch (err) {
    return { input: args };
  }
}

/**
 * Native tool use: assistant `tool_calls` become `tool_use` blocks and `tool`
 * role messages become `tool_result` blocks in a user message. Consecutive
 * tool results are merged into one user message, as the API requires.
 */
async function appendNativeToolMessage(messages: AnthropicV1Message<AnthropicV1ContentObject[]>[], message: Message) {
  if (message.role === MessageRole.tool) {
    const block: AnthropicV1ToolResultContent = {
      type: 'tool_result',
      tool_use_id: message.tool_call_id,
      content: convertContentTypeToString(message.content) || '',
    };
    const last = messages[messages.length - 1];
    if (last?.role === 'user' && last.content.every((c) => c.type === 'tool_result')) {
      last.content.push(block);
    } else {
      messages.push({ role: 'user', content: [block] });
    }
    return;
  }
  if (message.role === MessageRole.assistant && message.tool_calls?.length) {
    const content: AnthropicV1ContentObject[] = [];
    const text = message.content ? convertContentTypeToString(message.content) : '';
    if (text) {
      content.push({ type: 'text', text });
    }
    for (const call of message.tool_calls) {
      content.push({
        type: 'tool_use',
        id: call.id,
        name: call.function.name,
        input: parseToolArguments(call.function.arguments),
      });
    }
    messages.push({ role: 'assistant', content });
    return;
  }
  messages.push(await mapAnthropicV1Message(message) as AnthropicV1Message<AnthropicV1ContentObject[]>);
}

async function createAnthropicV1Prompts(prompt: ChatPrompt, functions?: Function[], nativeTools = false) {
  const messages = [];
  const systemPrompts = [];
  if (prompt.history) {
    for (const message of prompt.history) {
      if (message.role === 'system') {
        systemPrompts.push(convertContentTypeToString(message.content));
        continue;
      }
      if (nativeTools) {
        await appendNativeToolMessage(messages, message);
      } else if (message.role !== 'function') {
        messages.push(await mapAnthropicV1Message(message));
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
    if (nativeTools) {
      await appendNativeToolMessage(messages, message);
    } else if (message.role !== 'function') {
      const msg = await mapAnthropicV1Message(message);
      messages.push(msg);
    }
  }
  if (!nativeTools && functions?.length) {
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
    tools,
    tool_choice,
    user,
  } = request;
  const {
    temperature,
    top_k,
    top_p,
    stop = [],
    max_tokens,
  } = model_params;
  // `tools` requests use native tool use; legacy `functions` requests keep
  // the prompt-embedded ReAct format.
  const nativeTools = !!tools?.length;
  const { system, messages } = await createAnthropicV1Prompts(prompt, functions, nativeTools);
  const req: AnthropicV1ChatCompletionRequest = {
    model,
    messages,
    system,
    max_tokens: max_tokens || DEFAULT_MAX_TOKENS,
    metadata: { user_id: user },
    temperature,
    stop_sequences: typeof stop === 'string' ? [stop] : stop,
    stream,
    top_p,
    top_k,
  };
  if (nativeTools) {
    req.tools = tools.map((t) => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters || { type: 'object', properties: {} },
    }));
    const choice = toAnthropicToolChoice(tool_choice);
    if (choice) {
      req.tool_choice = choice;
    }
  }
  return req;
}

const DEFAULT_MAX_TOKENS = 4096;

function toAnthropicToolChoice(toolChoice: string | object): AnthropicV1ChatCompletionRequest['tool_choice'] {
  if (!toolChoice || toolChoice === 'none') return undefined;
  if (toolChoice === 'auto') return { type: 'auto' };
  if (toolChoice === 'required') return { type: 'any' };
  const name = (toolChoice as any).function?.name || (toolChoice as any).name;
  if (name) return { type: 'tool', name };
  return undefined;
}

function fromAnthropicToolUse(response: AnthropicV1ChatCompletionResponse) {
  const { content, id, model, usage } = response;
  const text = content
    .filter((c) => c.type === 'text')
    .map((c: any) => c.text)
    .join('\n');
  const tool_calls = content
    .filter((c): c is AnthropicV1ToolUseContent => c.type === 'tool_use')
    .map((c) => ({
      id: c.id,
      type: 'function',
      function: { name: c.name, arguments: JSON.stringify(c.input ?? {}) },
    }));
  return {
    id,
    created: new Date(),
    model,
    n: 1,
    choices: [
      {
        index: 0,
        finish_reason: 'tool_calls',
        message: {
          role: MessageRole.assistant,
          content: text || null,
          tool_calls,
        },
      },
    ],
    usage: toUsage(usage),
  };
}

function toUsage(usage: AnthropicV1ChatCompletionResponse['usage']) {
  const completion_tokens = usage?.output_tokens || 0;
  const prompt_tokens = (usage?.input_tokens || 0)
    + (usage?.cache_creation_input_tokens || 0)
    + (usage?.cache_read_input_tokens || 0);
  return {
    completion_tokens,
    prompt_tokens,
    total_tokens: prompt_tokens + completion_tokens,
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

  if (content.some((c) => c.type === 'tool_use')) {
    return fromAnthropicToolUse(response);
  }
  const text = content
    .filter((c) => c.type === 'text')
    .map((c: any) => c.text)
    .join('\n');

  const { json, nonJsonStr } = await parserService.parse('json', text);
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
          content: text,
        },
      }
    ];
  }
  return {
    id,
    created: new Date(),
    model,
    n: choices.length,
    choices,
    usage: toUsage(usage),
  };
}
