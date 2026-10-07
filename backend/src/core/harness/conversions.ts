import * as uuid from 'uuid';

import {
  ChatResponse,
  ContentObject,
  Message,
  MessageRole,
  ToolCall as RosettaToolCall,
  convertContentTypeToString,
} from '../conversions/RosettaStone';
import type {
  AssistantMessage,
  HarnessMessage,
  HarnessTool,
  ImageContent,
  LlmMessage,
  TextContent,
  ToolCall,
  Usage,
} from '../../lib/harness';
import { emptyUsage } from '../../lib/harness';

/**
 * Conversions between harness messages (pi-style content blocks) and the
 * RosettaStone message format used by promptstore's provider plugins.
 */

function toRosettaContent(content: string | (TextContent | ImageContent)[]): string | ContentObject[] {
  if (typeof content === 'string') return content;
  const hasImage = content.some((c) => c.type === 'image');
  if (!hasImage) {
    return content.map((c) => (c as TextContent).text).join('\n');
  }
  return content.map((c) => {
    if (c.type === 'text') return { type: 'text', text: c.text };
    const url = c.url || (c.data.startsWith('http') || c.data.startsWith('data:')
      ? c.data
      : `data:${c.mimeType || 'image/png'};base64,${c.data}`);
    return { type: 'image_url', image_url: { url } };
  }) as ContentObject[];
}

/**
 * Harness LLM messages -> RosettaStone messages. With `legacy`, tool calls are
 * replayed as `function_call` / `function` messages for providers that only
 * support prompt-embedded function emulation.
 */
export function toRosettaMessages(messages: LlmMessage[], legacy = false): Message[] {
  const out: Message[] = [];
  for (const m of messages) {
    if (m.role === 'user') {
      out.push({ role: MessageRole.user, content: toRosettaContent(m.content) });
    } else if (m.role === 'assistant') {
      const text = m.content
        .filter((c): c is TextContent => c.type === 'text')
        .map((c) => c.text)
        .join('\n');
      const calls = m.content.filter((c): c is ToolCall => c.type === 'toolCall');
      const msg: Message = { role: MessageRole.assistant, content: text || (calls.length ? null : '') };
      if (calls.length && legacy) {
        // emulation supports a single call per turn
        msg.function_call = { name: calls[0].name, arguments: JSON.stringify(calls[0].arguments ?? {}) };
      } else if (calls.length) {
        msg.tool_calls = calls.map((c) => ({
          id: c.id,
          type: 'function',
          function: { name: c.name, arguments: JSON.stringify(c.arguments ?? {}) },
        }));
      }
      out.push(msg);
    } else if (m.role === 'toolResult') {
      out.push({
        role: legacy ? MessageRole.function : MessageRole.tool,
        tool_call_id: legacy ? undefined : m.toolCallId,
        name: m.toolName,
        content: m.content.map((c) => (c.type === 'text' ? c.text : '[image]')).join('\n'),
      });
    }
  }
  return out;
}

/** RosettaStone prompt/history messages -> harness messages. System messages are excluded. */
export function fromRosettaMessages(messages: Message[] = []): HarnessMessage[] {
  const out: HarnessMessage[] = [];
  for (const m of messages) {
    if (m.role === 'system' || m.role === 'developer') continue;
    if (m.role === 'assistant') {
      const content: AssistantMessage['content'] = [];
      const text = m.content ? convertContentTypeToString(m.content) : '';
      if (text) content.push({ type: 'text', text });
      for (const call of m.tool_calls || []) {
        content.push({ type: 'toolCall', id: call.id, name: call.function.name, arguments: parseArgs(call.function.arguments) });
      }
      out.push({ role: 'assistant', content, usage: emptyUsage(), stopReason: content.some((c) => c.type === 'toolCall') ? 'toolUse' : 'stop', timestamp: Date.now() });
    } else if (m.role === 'tool' || m.role === 'function') {
      out.push({
        role: 'toolResult',
        toolCallId: m.tool_call_id || m.name,
        toolName: m.name,
        content: [{ type: 'text', text: convertContentTypeToString(m.content) }],
        isError: false,
        timestamp: Date.now(),
      });
    } else {
      let content: string | (TextContent | ImageContent)[];
      if (typeof m.content === 'string') {
        content = m.content;
      } else if (Array.isArray(m.content)) {
        content = (m.content as any[]).map((c) => {
          if (typeof c === 'string') return { type: 'text', text: c } as TextContent;
          if (c.type === 'image_url') return { type: 'image', data: c.image_url.url, url: c.image_url.url } as ImageContent;
          return { type: 'text', text: c.text ?? '' } as TextContent;
        });
      } else {
        content = convertContentTypeToString(m.content);
      }
      out.push({ role: 'user', content, timestamp: Date.now() });
    }
  }
  return out;
}

export function toRosettaTools(tools: HarnessTool[] = []) {
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters && Object.keys(t.parameters).length
        ? t.parameters
        : { type: 'object', properties: {} },
    },
  }));
}

export function parseArgs(args: any): Record<string, any> {
  if (args && typeof args === 'object') return args;
  if (typeof args !== 'string' || !args.trim()) return {};
  try {
    const parsed = JSON.parse(args);
    return parsed && typeof parsed === 'object' ? parsed : { input: parsed };
  } catch (err) {
    return { input: args };
  }
}

/** Provider ChatResponse -> harness AssistantMessage. */
export function fromChatResponse(response: ChatResponse, usage: Usage, provider: string): AssistantMessage {
  const choice = response.choices?.[0];
  const message = choice?.message;
  const content: AssistantMessage['content'] = [];
  const text = message?.content ? convertContentTypeToString(message.content) : '';
  const calls: RosettaToolCall[] = message?.tool_calls || [];
  for (const call of calls) {
    content.push({
      type: 'toolCall',
      id: call.id || uuid.v4(),
      name: call.function.name,
      arguments: parseArgs(call.function.arguments),
    });
  }
  // legacy single function_call (prompt-embedded tool emulation)
  if (!calls.length && message?.function_call?.name) {
    content.push({
      type: 'toolCall',
      id: `call_${uuid.v4().replace(/-/g, '').slice(0, 12)}`,
      name: message.function_call.name,
      arguments: parseArgs(message.function_call.arguments),
    });
  }
  if (text) content.unshift({ type: 'text', text });
  const hasToolCalls = content.some((c) => c.type === 'toolCall');
  const finish = choice?.finish_reason;
  return {
    role: 'assistant',
    content,
    provider,
    model: response.model,
    usage,
    stopReason: hasToolCalls
      ? (finish === 'length' || finish === 'max_tokens' ? 'length' : 'toolUse')
      : (finish === 'length' || finish === 'max_tokens' ? 'length' : 'stop'),
    timestamp: Date.now(),
  };
}

/**
 * Build the semantic function's ChatResponse from the run's final assistant
 * message. When the run ended through a terminating structured-output tool,
 * its arguments are returned as `function_call` (and `tool_calls`), the shape
 * existing callers already parse.
 */
export function toChatResponse({
  final,
  outputToolCall,
  model,
}: {
  final?: AssistantMessage;
  outputToolCall?: ToolCall;
  model: string;
}): ChatResponse {
  let message: Message;
  if (outputToolCall) {
    const args = JSON.stringify(outputToolCall.arguments ?? {});
    message = {
      role: MessageRole.assistant,
      content: null,
      function_call: { name: outputToolCall.name, arguments: args },
      tool_calls: [{ id: outputToolCall.id, type: 'function', function: { name: outputToolCall.name, arguments: args } }],
    };
  } else {
    const text = (final?.content || [])
      .filter((c): c is TextContent => c.type === 'text')
      .map((c) => c.text)
      .join('\n');
    message = { role: MessageRole.assistant, content: text, final: true };
  }
  return {
    id: uuid.v4(),
    created: new Date(),
    model: final?.model || model,
    n: 1,
    choices: [{ index: 0, finish_reason: final?.stopReason === 'length' ? 'length' : 'stop', message }],
    usage: undefined,
  };
}
