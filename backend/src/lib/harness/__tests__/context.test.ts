import { describe, expect, it } from 'vitest';

import {
  COMPACTION_SUMMARY_TYPE,
  compact,
  findCutPoint,
  shouldCompact,
} from '../compaction';
import { buildSessionContext, InMemorySessionStore, loadSessionContext } from '../session';
import type { HarnessMessage, UserMessage } from '../types';
import { assistant } from './fakeStream';

const user = (text: string): UserMessage => ({ role: 'user', content: text, timestamp: 0 });
const big = (n: number) => 'x'.repeat(n * 4); // ~n tokens

describe('compaction', () => {

  it('shouldCompact respects the reserve', () => {
    const s = { enabled: true, reserveTokens: 100, keepRecentTokens: 50 };
    expect(shouldCompact(950, 1000, s)).toBe(true);
    expect(shouldCompact(800, 1000, s)).toBe(false);
    expect(shouldCompact(950, 1000, { ...s, enabled: false })).toBe(false);
  });

  it('never cuts at a tool result', () => {
    const messages: HarnessMessage[] = [
      user(big(100)),
      assistant({ toolCalls: [{ id: 'a', name: 't', arguments: {} }] }),
      { role: 'toolResult', toolCallId: 'a', toolName: 't', content: [{ type: 'text', text: big(100) }], isError: false, timestamp: 0 },
      assistant({ text: big(10) }),
    ];
    const cut = findCutPoint(messages, 50);
    expect(messages[cut].role).not.toBe('toolResult');
    expect(cut).toBe(1);
  });

  it('replaces older history with a summary', async () => {
    const messages: HarnessMessage[] = [
      user(big(100)), assistant({ text: big(100) }),
      user(big(100)), assistant({ text: big(10) }),
    ];
    let seen = '';
    const result = await compact(messages, { enabled: true, reserveTokens: 0, keepRecentTokens: 50 }, async (conv) => {
      seen = conv;
      return 'SUMMARY';
    });
    expect(result).toBeDefined();
    expect(seen).toContain('[User]:');
    expect(result!.messages[0]).toMatchObject({ role: 'custom', customType: COMPACTION_SUMMARY_TYPE, content: 'SUMMARY' });
    expect(result!.messages.slice(1)).toEqual(messages.slice(result!.firstKeptIndex));
  });

  it('returns undefined when everything fits', async () => {
    const result = await compact([user('hi')], { enabled: true, reserveTokens: 0, keepRecentTokens: 1000 }, async () => 'S');
    expect(result).toBeUndefined();
  });
});

describe('session tree', () => {

  it('appends, branches and rebuilds context', async () => {
    const store = new InMemorySessionStore();
    const s = 'sess';
    const e1 = await store.append(s, { type: 'message', message: user('one') });
    await store.append(s, { type: 'message', message: user('two') });
    expect((await loadSessionContext(store, s)).messages.map((m: any) => m.content)).toEqual(['one', 'two']);

    await store.branch(s, e1.id);
    await store.append(s, { type: 'message', message: user('two-b') });
    expect((await loadSessionContext(store, s)).messages.map((m: any) => m.content)).toEqual(['one', 'two-b']);
    expect(await store.getEntries(s)).toHaveLength(3);
  });

  it('applies compaction checkpoints', async () => {
    const store = new InMemorySessionStore();
    const s = 'sess';
    await store.append(s, { type: 'message', message: user('old') });
    const kept = await store.append(s, { type: 'message', message: user('kept') });
    await store.append(s, { type: 'model_change', model: 'm2' });
    await store.append(s, {
      type: 'compaction',
      summary: { role: 'custom', customType: COMPACTION_SUMMARY_TYPE, content: 'S', timestamp: 0 },
      firstKeptEntryId: kept.id,
      tokensBefore: 100,
    });
    await store.append(s, { type: 'message', message: user('new') });
    const entries = await store.getEntries(s);
    const ctx = buildSessionContext(entries, await store.getLeafId(s));
    expect(ctx.messages.map((m: any) => m.content)).toEqual(['S', 'kept', 'new']);
    expect(ctx.model).toEqual({ provider: undefined, model: 'm2' });
  });
});
