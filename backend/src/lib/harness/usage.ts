import type { HarnessMessage, Usage } from './types';

export function emptyUsage(): Usage {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: 0 };
}

export function addUsage(a: Usage, b?: Partial<Usage>): Usage {
  if (!b) return a;
  return {
    input: a.input + (b.input || 0),
    output: a.output + (b.output || 0),
    cacheRead: a.cacheRead + (b.cacheRead || 0),
    cacheWrite: a.cacheWrite + (b.cacheWrite || 0),
    totalTokens: a.totalTokens + (b.totalTokens || 0),
    cost: a.cost + (b.cost || 0),
  };
}

/** Sum usage over assistant messages in a transcript. */
export function totalUsage(messages: HarnessMessage[]): Usage {
  let total = emptyUsage();
  for (const m of messages) {
    if (m.role === 'assistant') {
      total = addUsage(total, m.usage);
    }
  }
  return total;
}
