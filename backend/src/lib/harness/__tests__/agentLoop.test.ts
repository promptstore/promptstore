import { describe, expect, it } from 'vitest';

import { Agent } from '../Agent';
import { agentLoop, runAgentLoop } from '../agentLoop';
import { withLimits } from '../limits';
import type { AgentEvent, HarnessContext, HarnessTool, ToolResultMessage, UserMessage } from '../types';
import { scriptedStream } from './fakeStream';

const user = (text: string): UserMessage => ({ role: 'user', content: text, timestamp: Date.now() });

function tool(name: string, impl: (args: any) => Promise<string> | string, extra: Partial<HarnessTool> = {}): HarnessTool {
  return {
    name,
    description: name,
    parameters: { type: 'object', properties: { x: { type: 'number' } }, required: ['x'] },
    execute: async (_id, args) => ({ content: [{ type: 'text', text: await impl(args) }] }),
    ...extra,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('agent loop', () => {

  it('runs model -> tool -> model until the model stops', async () => {
    const { streamFn, contexts } = scriptedStream([
      { toolCalls: [{ id: 't1', name: 'double', arguments: { x: 2 } }] },
      { text: 'The answer is 4' },
    ]);
    const ctx: HarnessContext = { systemPrompt: 'sys', messages: [], tools: [tool('double', (a) => String(a.x * 2))] };
    const events: AgentEvent[] = [];
    const messages = await runAgentLoop([user('double 2')], ctx, {}, (e) => { events.push(e); }, undefined, streamFn);

    expect(messages.map((m) => m.role)).toEqual(['user', 'assistant', 'toolResult', 'assistant']);
    expect((messages[2] as ToolResultMessage).content[0]).toEqual({ type: 'text', text: '4' });
    expect(contexts[1].messages.map((m) => m.role)).toEqual(['user', 'assistant', 'toolResult']);
    expect(contexts[0].systemPrompt).toBe('sys');
    const types = events.map((e) => e.type);
    expect(types[0]).toBe('agent_start');
    expect(types[types.length - 1]).toBe('agent_end');
    expect(types.filter((t) => t === 'turn_start')).toHaveLength(2);
  });

  it('feeds validation errors back to the model (with coercion)', async () => {
    const { streamFn, contexts } = scriptedStream([
      { toolCalls: [{ id: 'a', name: 'double', arguments: { y: 1 } }, { id: 'b', name: 'double', arguments: { x: '3' } }] },
      { text: 'ok' },
    ]);
    const ctx: HarnessContext = { messages: [], tools: [tool('double', (a) => String(a.x * 2))] };
    const messages = await runAgentLoop([user('go')], ctx, {}, () => { }, undefined, streamFn);
    const [bad, good] = messages.filter((m): m is ToolResultMessage => m.role === 'toolResult');
    expect(bad.isError).toBe(true);
    expect((bad.content[0] as any).text).toMatch(/Validation failed for tool "double"/);
    expect(good.isError).toBe(false);
    expect((good.content[0] as any).text).toBe('6');
    expect(contexts).toHaveLength(2);
  });

  it('reports unknown tools and thrown tool errors as error results', async () => {
    const { streamFn } = scriptedStream([
      { toolCalls: [{ id: 'a', name: 'nope', arguments: {} }, { id: 'b', name: 'boom', arguments: { x: 1 } }] },
      { text: 'ok' },
    ]);
    const ctx: HarnessContext = { messages: [], tools: [tool('boom', () => { throw new Error('kaboom'); })] };
    const messages = await runAgentLoop([user('go')], ctx, {}, () => { }, undefined, streamFn);
    const results = messages.filter((m): m is ToolResultMessage => m.role === 'toolResult');
    expect((results[0].content[0] as any).text).toBe('Tool nope not found');
    expect((results[1].content[0] as any).text).toBe('kaboom');
    expect(results.every((r) => r.isError)).toBe(true);
  });

  it('runs tools in parallel by default and keeps results in call order', async () => {
    const { streamFn } = scriptedStream([
      { toolCalls: [{ id: 'slow', name: 'slow', arguments: { x: 1 } }, { id: 'fast', name: 'fast', arguments: { x: 1 } }] },
      { text: 'ok' },
    ]);
    const ctx: HarnessContext = {
      messages: [],
      tools: [
        tool('slow', async () => { await sleep(30); return 'slow'; }),
        tool('fast', async () => 'fast'),
      ],
    };
    const ends: string[] = [];
    const messages = await runAgentLoop([user('go')], ctx, {}, (e) => {
      if (e.type === 'tool_execution_end') ends.push(e.toolCallId);
    }, undefined, streamFn);
    expect(ends).toEqual(['fast', 'slow']);
    const results = messages.filter((m): m is ToolResultMessage => m.role === 'toolResult');
    expect(results.map((r) => r.toolCallId)).toEqual(['slow', 'fast']);
  });

  it('runs sequentially when a tool requires it', async () => {
    const { streamFn } = scriptedStream([
      { toolCalls: [{ id: 'slow', name: 'slow', arguments: { x: 1 } }, { id: 'fast', name: 'fast', arguments: { x: 1 } }] },
      { text: 'ok' },
    ]);
    const ctx: HarnessContext = {
      messages: [],
      tools: [
        tool('slow', async () => { await sleep(20); return 'slow'; }, { executionMode: 'sequential' }),
        tool('fast', async () => 'fast'),
      ],
    };
    const ends: string[] = [];
    await runAgentLoop([user('go')], ctx, {}, (e) => {
      if (e.type === 'tool_execution_end') ends.push(e.toolCallId);
    }, undefined, streamFn);
    expect(ends).toEqual(['slow', 'fast']);
  });

  it('beforeToolCall can block, and terminate ends the run when all results terminate', async () => {
    const { streamFn, calls } = scriptedStream([
      { toolCalls: [{ id: 'a', name: 'double', arguments: { x: 1 } }] },
      { toolCalls: [{ id: 'b', name: 'double', arguments: { x: 2 } }] },
      { text: 'never' },
    ]);
    let executed = 0;
    const ctx: HarnessContext = { messages: [], tools: [tool('double', (a) => { executed++; return String(a.x * 2); })] };
    const messages = await runAgentLoop([user('go')], ctx, {
      beforeToolCall: async ({ toolCall }) =>
        toolCall.id === 'a' ? { block: true, reason: 'not allowed' } : { terminate: true },
    }, () => { }, undefined, streamFn);
    const results = messages.filter((m): m is ToolResultMessage => m.role === 'toolResult');
    expect((results[0].content[0] as any).text).toBe('not allowed');
    expect(executed).toBe(1);
    expect(calls()).toBe(2);
  });

  it('afterToolCall overrides result fields', async () => {
    const { streamFn } = scriptedStream([
      { toolCalls: [{ id: 'a', name: 'double', arguments: { x: 1 } }] },
      { text: 'ok' },
    ]);
    const ctx: HarnessContext = { messages: [], tools: [tool('double', () => 'secret')] };
    const messages = await runAgentLoop([user('go')], ctx, {
      afterToolCall: async () => ({ content: [{ type: 'text', text: '[redacted]' }] }),
    }, () => { }, undefined, streamFn);
    const result = messages.find((m): m is ToolResultMessage => m.role === 'toolResult')!;
    expect((result.content[0] as any).text).toBe('[redacted]');
  });

  it('rejects tool calls when the response hit the length limit', async () => {
    const { streamFn } = scriptedStream([
      { toolCalls: [{ id: 'a', name: 'double', arguments: { x: 1 } }], stopReason: 'length' },
      { text: 'ok' },
    ]);
    let executed = 0;
    const ctx: HarnessContext = { messages: [], tools: [tool('double', () => { executed++; return '2'; })] };
    const messages = await runAgentLoop([user('go')], ctx, {}, () => { }, undefined, streamFn);
    expect(executed).toBe(0);
    const result = messages.find((m): m is ToolResultMessage => m.role === 'toolResult')!;
    expect(result.isError).toBe(true);
  });

  it('stops on provider errors and on StreamFn throws', async () => {
    for (const turn of [{ error: 'rate limited' }, { throws: 'network down' }]) {
      const { streamFn } = scriptedStream([turn as any]);
      const messages = await runAgentLoop([user('go')], { messages: [] }, {}, () => { }, undefined, streamFn);
      const last = messages[messages.length - 1] as any;
      expect(last.role).toBe('assistant');
      expect(last.stopReason).toBe('error');
      expect(last.errorMessage).toMatch(/rate limited|network down/);
    }
  });

  it('exposes an event stream with a result promise', async () => {
    const { streamFn } = scriptedStream([{ text: 'hi' }]);
    const stream = agentLoop([user('go')], { messages: [] }, {}, undefined, streamFn);
    const types: string[] = [];
    for await (const e of stream) types.push(e.type);
    const messages = await stream.result();
    expect(types).toContain('agent_end');
    expect(messages).toHaveLength(2);
  });

  it('prepareNextTurn can replace the context', async () => {
    const { streamFn, contexts } = scriptedStream([
      { toolCalls: [{ id: 'a', name: 'double', arguments: { x: 1 } }] },
      { text: 'ok' },
    ]);
    const ctx: HarnessContext = { messages: [], tools: [tool('double', () => '2')] };
    const events: AgentEvent[] = [];
    await runAgentLoop([user('go')], ctx, {
      prepareNextTurn: ({ context }) => ({ context: { ...context, messages: [user('summary')] } }),
    }, (e) => { events.push(e); }, undefined, streamFn);
    expect(contexts[1].messages).toHaveLength(1);
    expect(events.some((e) => e.type === 'context_replaced')).toBe(true);
  });
});

describe('limits', () => {

  it('maxTurns ends the run', async () => {
    const loopForever = Array.from({ length: 10 }, (_, i) => ({ toolCalls: [{ id: `t${i}`, name: 'double', arguments: { x: i } }] }));
    const { streamFn, calls } = scriptedStream(loopForever);
    const limits = withLimits({ maxTurns: 3 });
    const ctx: HarnessContext = { messages: [], tools: [tool('double', (a) => String(a.x * 2))] };
    await runAgentLoop([user('go')], ctx, { finishTurn: limits.finishTurn }, () => { }, limits.signal, streamFn);
    limits.dispose();
    expect(calls()).toBe(3);
    expect(limits.stoppedBy).toBe('maxTurns');
  });

  it('maxCostUsd ends the run', async () => {
    const turns = Array.from({ length: 10 }, (_, i) => ({ cost: 0.4, toolCalls: [{ id: `t${i}`, name: 'double', arguments: { x: i } }] }));
    const { streamFn, calls } = scriptedStream(turns);
    const limits = withLimits({ maxCostUsd: 1 });
    const ctx: HarnessContext = { messages: [], tools: [tool('double', (a) => String(a.x * 2))] };
    await runAgentLoop([user('go')], ctx, { finishTurn: limits.finishTurn }, () => { }, limits.signal, streamFn);
    limits.dispose();
    expect(calls()).toBe(3);
    expect(limits.stoppedBy).toBe('maxCostUsd');
  });

  it('maxDurationMs aborts running tools', async () => {
    const { streamFn } = scriptedStream([
      { toolCalls: [{ id: 'a', name: 'wait', arguments: { x: 1 } }] },
      { text: 'never' },
    ]);
    const limits = withLimits({ maxDurationMs: 20 });
    const waitTool: HarnessTool = {
      name: 'wait', description: 'wait', parameters: {},
      execute: (_id, _a, signal) => new Promise((_, reject) => {
        signal?.addEventListener('abort', () => reject(new Error('aborted by signal')));
      }),
    };
    const messages = await runAgentLoop([user('go')], { messages: [], tools: [waitTool] },
      { finishTurn: limits.finishTurn }, () => { }, limits.signal, streamFn);
    limits.dispose();
    expect(limits.stoppedBy).toBe('maxDurationMs');
    const result = messages.find((m): m is ToolResultMessage => m.role === 'toolResult')!;
    expect((result.content[0] as any).text).toBe('aborted by signal');
    expect(messages[messages.length - 1].role).toBe('toolResult');
  });
});

describe('Agent', () => {

  it('keeps state and rejects concurrent prompts', async () => {
    const { streamFn } = scriptedStream([
      { toolCalls: [{ id: 'a', name: 'double', arguments: { x: 1 } }] },
      { text: 'two' },
    ]);
    const agent = new Agent({ streamFn, tools: [tool('double', async () => { await sleep(10); return '2'; })] });
    const seen: string[] = [];
    agent.subscribe((e) => { seen.push(e.type); });
    const run = agent.prompt('double 1');
    await expect(agent.prompt('again')).rejects.toThrow(/already processing/);
    await run;
    expect(agent.state.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'toolResult', 'assistant']);
    expect(agent.state.isStreaming).toBe(false);
    expect(seen[seen.length - 1]).toBe('agent_end');
  });

  it('delivers steering after tool execution and follow-ups when idle', async () => {
    const { streamFn, contexts } = scriptedStream([
      { toolCalls: [{ id: 'a', name: 'double', arguments: { x: 1 } }] },
      { text: 'after steer' },
      { text: 'after follow-up' },
    ]);
    const agent = new Agent({ streamFn, tools: [tool('double', () => '2')] });
    agent.subscribe((e) => {
      if (e.type === 'tool_execution_start') {
        agent.steer(user('steer!'));
        agent.followUp(user('follow up'));
      }
    });
    await agent.prompt('go');
    expect(contexts).toHaveLength(3);
    const lastUser = (ctx: any) => [...ctx.messages].reverse().find((m: any) => m.role === 'user').content;
    expect(lastUser(contexts[1])).toBe('steer!');
    expect(lastUser(contexts[2])).toBe('follow up');
  });

  it('abort() stops the run and records the error', async () => {
    const { streamFn } = scriptedStream([
      { toolCalls: [{ id: 'a', name: 'wait', arguments: {} }] },
      { text: 'never' },
    ]);
    const waitTool: HarnessTool = {
      name: 'wait', description: 'wait', parameters: {},
      execute: (_id, _a, signal) => new Promise((_, reject) => {
        signal?.addEventListener('abort', () => reject(new Error('cancelled')));
      }),
    };
    const agent = new Agent({ streamFn, tools: [waitTool] });
    agent.subscribe((e) => {
      if (e.type === 'tool_execution_start') setTimeout(() => agent.abort(), 5);
    });
    await agent.prompt('go');
    const last = agent.state.messages[agent.state.messages.length - 1] as ToolResultMessage;
    expect(last.role).toBe('toolResult');
    expect(last.isError).toBe(true);
    expect(agent.state.isStreaming).toBe(false);
  });
});
