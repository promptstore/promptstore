import { describe, expect, it } from 'vitest';

import { MessageRole } from '../../../../core/conversions/RosettaStone';
import { fromAnthropicV1ChatResponse, toAnthropicV1ChatRequest } from '../conversions';

const parserService: any = {
  parse: async () => ({ json: null, nonJsonStr: '' }),
};

describe('anthropic native tool use', () => {

  it('maps tools, tool calls and merged tool results', async () => {
    const req: any = await toAnthropicV1ChatRequest({
      model: 'claude-sonnet-5-5',
      model_params: {},
      tools: [{ type: 'function', function: { name: 'add', description: 'add', parameters: { type: 'object', properties: {} } } }],
      tool_choice: 'auto',
      prompt: {
        context: { system_prompt: 'sys' },
        messages: [
          { role: MessageRole.user, content: 'add things' },
          {
            role: MessageRole.assistant,
            content: 'calling',
            tool_calls: [
              { id: 't1', type: 'function', function: { name: 'add', arguments: '{"a":1}' } },
              { id: 't2', type: 'function', function: { name: 'add', arguments: '{"a":2}' } },
            ],
          },
          { role: MessageRole.tool, tool_call_id: 't1', content: '1' },
          { role: MessageRole.tool, tool_call_id: 't2', content: '2' },
        ],
      },
    } as any);

    expect(req.tools).toEqual([{ name: 'add', description: 'add', input_schema: { type: 'object', properties: {} } }]);
    expect(req.tool_choice).toEqual({ type: 'auto' });
    expect(req.max_tokens).toBe(4096);
    expect(req.system).not.toMatch(/add/); // no prompt-embedded function descriptions
    expect(req.messages).toHaveLength(3);
    expect(req.messages[1].content).toEqual([
      { type: 'text', text: 'calling' },
      { type: 'tool_use', id: 't1', name: 'add', input: { a: 1 } },
      { type: 'tool_use', id: 't2', name: 'add', input: { a: 2 } },
    ]);
    expect(req.messages[2]).toEqual({
      role: 'user',
      content: [
        { type: 'tool_result', tool_use_id: 't1', content: '1' },
        { type: 'tool_result', tool_use_id: 't2', content: '2' },
      ],
    });
  });

  it('maps tool_use responses to tool_calls', async () => {
    const res: any = await fromAnthropicV1ChatResponse({
      id: 'm1', type: 'message', role: 'assistant', model: 'claude', stop_reason: 'tool_use', stop_sequence: null,
      content: [
        { type: 'text', text: 'let me add' },
        { type: 'tool_use', id: 'tu1', name: 'add', input: { a: 1, b: 2 } },
      ],
      usage: { input_tokens: 10, output_tokens: 5 },
    } as any, parserService);
    const message = res.choices[0].message;
    expect(message.content).toBe('let me add');
    expect(message.tool_calls).toEqual([{ id: 'tu1', type: 'function', function: { name: 'add', arguments: '{"a":1,"b":2}' } }]);
    expect(res.usage.total_tokens).toBe(15);
  });

  it('keeps the legacy prompt-embedded path for functions-only requests', async () => {
    const req: any = await toAnthropicV1ChatRequest({
      model: 'claude',
      model_params: { max_tokens: 100 },
      functions: [{ name: 'search', description: 'search the web', parameters: { type: 'object', properties: {} } }],
      prompt: { messages: [{ role: MessageRole.user, content: 'hi' }] },
    } as any);
    expect(req.tools).toBeUndefined();
    expect(req.system).toMatch(/search/);
  });
});
