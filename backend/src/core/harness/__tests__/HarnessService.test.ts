import { describe, expect, it } from 'vitest';

import { InMemorySessionStore } from '../../../lib/harness';
import type { HarnessTool } from '../../../lib/harness';
import { MessageRole } from '../../conversions/RosettaStone';
import { HarnessService } from '../HarnessService';

type Reply = { content?: string; tool_calls?: { id: string; name: string; args: any }[]; error?: string };

/** Minimal stand-in for LLMChatModel that replays scripted replies. */
function fakeModel(replies: Reply[]) {
  const requests: any[] = [];
  let i = 0;
  const model: any = {
    modelType: 'gpt',
    contextWindow: 100000,
    async call({ request }: any) {
      requests.push(structuredClone(request));
      const r = replies[i++] ?? { content: 'done' };
      if (r.error) throw new Error(r.error);
      return {
        response: {
          id: 'x', created: new Date(), model: 'fake-model', n: 1,
          choices: [{
            index: 0,
            finish_reason: r.tool_calls ? 'tool_calls' : 'stop',
            message: {
              role: MessageRole.assistant,
              content: r.content ?? null,
              tool_calls: r.tool_calls?.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.args) } })),
            },
          }],
        },
        responseMetadata: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      };
    },
  };
  return { model, requests };
}

const adder: HarnessTool = {
  name: 'add',
  description: 'add two numbers',
  parameters: { type: 'object', properties: { a: { type: 'number' }, b: { type: 'number' } }, required: ['a', 'b'] },
  execute: async (_id, { a, b }) => ({ content: [{ type: 'text', text: String(a + b) }] }),
};

const logger = { error: () => { }, warn: () => { }, debug: () => { }, info: () => { } };

function service(opts: { sessionStore?: any; spans?: any[] } = {}) {
  const spans = opts.spans ?? [];
  return HarnessService({
    logger,
    toolResolver: { resolveTools: async (refs: any[] = []) => (refs.length ? [adder] : []) },
    telemetryIngestService: { ingest: async (s: any[]) => { spans.push(...s); return { accepted: s.length, dropped: 0 }; } },
    pricingService: { computeCost: async () => ({ cost_total: 0.01 }) },
    sessionStore: opts.sessionStore,
  });
}

const baseParams = (model: any) => ({
  name: 'calc',
  functionId: 'f1',
  model,
  provider: 'openai',
  modelKey: 'fake-model',
  modelParams: {},
  systemPrompt: 'You are a calculator.',
  prompts: [{ role: MessageRole.user, content: 'what is 2+3?' }],
  config: { enabled: true, tools: [{ type: 'tool' as const, key: 'add' }] },
  run: { workspaceId: 1, username: 'u' },
});

describe('HarnessService', () => {

  it('runs a tool loop through the model layer and returns a ChatResponse', async () => {
    const { model, requests } = fakeModel([
      { tool_calls: [{ id: 'c1', name: 'add', args: { a: 2, b: 3 } }] },
      { content: 'It is 5.' },
    ]);
    const spans: any[] = [];
    const { response, responseMetadata } = await service({ spans }).run(baseParams(model));

    expect(response.choices[0].message.content).toBe('It is 5.');
    expect(responseMetadata.harness.turns).toBe(2);
    expect(responseMetadata.harness.toolCalls).toBe(1);
    expect(responseMetadata.harness.stopReason).toBe('stop');
    expect(responseMetadata.promptTokens).toBe(20);
    expect(responseMetadata.harness.totalCostUsd).toBeCloseTo(0.02);

    // native tools sent, and the tool result replayed with its call id
    expect(requests[0].tools[0].function.name).toBe('add');
    expect(requests[0].prompt.context.system_prompt).toBe('You are a calculator.');
    const replay = requests[1].prompt.messages;
    expect(replay[1].tool_calls[0].id).toBe('c1');
    expect(replay[2]).toMatchObject({ role: 'tool', tool_call_id: 'c1', content: '5' });

    // canonical spans: run -> iteration -> model/tool
    const kinds = new Set(spans.map((s) => s.span_kind));
    expect(kinds).toEqual(new Set(['harness.run', 'loop.iteration', 'model.call', 'tool.call']));
    const closed = spans.filter((s) => s.end_time);
    const run = closed.find((s) => s.span_kind === 'harness.run');
    expect(run.status).toBe('ok');
    const tool = closed.find((s) => s.span_kind === 'tool.call');
    const iteration = closed.find((s) => s.span_kind === 'loop.iteration' && s.span_id === tool.parent_span_id);
    expect(iteration.parent_span_id).toBe(run.span_id);
    expect(new Set(spans.map((s) => s.trace_id)).size).toBe(1);

    // model.call carries the exact input sent
    const models = closed.filter((s) => s.span_kind === 'model.call');
    expect(models[0].content.input.system).toBe('You are a calculator.');
    expect(models[0].content.input.messages).toEqual([{ role: 'user', content: 'what is 2+3?' }]);
    expect(models[0].content.input.tools).toEqual(['add']);
    expect(models[1].content.input.messages.map((m: any) => m.role)).toEqual(['user', 'assistant', 'tool']);

    // each turn records a context breakdown, scaled to reported prompt tokens
    const iterations = closed.filter((s) => s.span_kind === 'loop.iteration');
    const assemble = iterations[1].events.find((e: any) => e.name === 'ps.context.assemble').attributes;
    expect(assemble.sources.map((x: any) => x.source)).toEqual(['system', 'tools', 'prompt', 'assistant', 'tool_result']);
    expect(assemble.window_tokens_after).toBeGreaterThan(0);
    expect(assemble.window_limit).toBe(100000);

    // run-level input and output
    expect(run.content.input.prompts).toEqual(['what is 2+3?']);
    expect(run.content.output).toBe('It is 5.');
  });

  it('returns structured output through a terminating output_formatter tool', async () => {
    const { model, requests } = fakeModel([
      { tool_calls: [{ id: 'o1', name: 'output_formatter', args: { answer: 5 } }] },
      { content: 'should not be called' },
    ]);
    const { response, responseMetadata } = await service().run({
      ...baseParams(model),
      returnTypeSchema: { type: 'object', properties: { answer: { type: 'number' } }, required: ['answer'] },
    });
    expect(requests).toHaveLength(1);
    expect(JSON.parse(response.choices[0].message.function_call.arguments)).toEqual({ answer: 5 });
    expect(responseMetadata.harness.stopReason).toBe('output');
  });

  it('stops at maxTurns and reports it', async () => {
    const loop = Array.from({ length: 5 }, (_, i) => ({ tool_calls: [{ id: `c${i}`, name: 'add', args: { a: i, b: 1 } }] }));
    const { model } = fakeModel(loop);
    const { responseMetadata } = await service().run({ ...baseParams(model), config: { ...baseParams(model).config, maxTurns: 2 } });
    expect(responseMetadata.harness.turns).toBe(2);
    expect(responseMetadata.harness.stoppedBy).toBe('maxTurns');
  });

  it('throws when the model call fails', async () => {
    const { model } = fakeModel([{ error: 'provider down' }]);
    const spans: any[] = [];
    await expect(service({ spans }).run(baseParams(model))).rejects.toThrow(/provider down/);
    const run = spans.filter((s) => s.end_time).find((s) => s.span_kind === 'harness.run');
    expect(run.status).toBe('error');
  });

  it('persists to and resumes from a session', async () => {
    const store = new InMemorySessionStore();
    const sessionStore = Object.assign(store, { ensureSession: async () => true });
    const svc = service({ sessionStore });

    const first = fakeModel([{ content: 'Hi Mark.' }]);
    await svc.run({ ...baseParams(first.model), prompts: [{ role: MessageRole.user, content: 'I am Mark' }], run: { workspaceId: 1, sessionId: 's1' } });

    const second = fakeModel([{ content: 'Your name is Mark.' }]);
    await svc.run({ ...baseParams(second.model), prompts: [{ role: MessageRole.user, content: 'what is my name?' }], run: { workspaceId: 1, sessionId: 's1' } });

    const sent = second.requests[0].prompt.messages.map((m: any) => m.content);
    expect(sent).toEqual(['I am Mark', 'Hi Mark.', 'what is my name?']);
    expect(await store.getEntries('s1')).toHaveLength(4);
  });

  it('streams events to onEvent and honours abort', async () => {
    const controller = new AbortController();
    const slow: HarnessTool = {
      ...adder,
      execute: (_id, _a, signal) => new Promise((_, reject) => signal?.addEventListener('abort', () => reject(new Error('cancelled')))),
    };
    const { model } = fakeModel([{ tool_calls: [{ id: 'c1', name: 'add', args: { a: 1, b: 1 } }] }]);
    const svc = HarnessService({ logger, toolResolver: { resolveTools: async () => [slow] } });
    const events: string[] = [];
    const result = await svc.run({
      ...baseParams(model),
      run: {
        signal: controller.signal,
        onEvent: (e) => {
          events.push(e.type);
          if (e.type === 'tool_execution_start') setTimeout(() => controller.abort(), 5);
        },
      },
    }).catch((err) => err);
    expect(events).toContain('agent_end');
    expect(result).toBeInstanceOf(Error);
    expect(result.harness).toMatchObject({ stopReason: 'aborted', turns: 1 });
  });
});
