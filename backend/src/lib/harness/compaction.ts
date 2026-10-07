import type { CustomMessage, HarnessMessage, LlmMessage, Usage } from './types';

export interface CompactionSettings {
  enabled: boolean;
  /** Tokens to keep free in the context window for the next response. */
  reserveTokens: number;
  /** Approximate tokens of recent history to keep verbatim. */
  keepRecentTokens: number;
}

export const DEFAULT_COMPACTION_SETTINGS: CompactionSettings = {
  enabled: true,
  reserveTokens: 16384,
  keepRecentTokens: 20000,
};

export const COMPACTION_SUMMARY_TYPE = 'compactionSummary';

export function shouldCompact(contextTokens: number, contextWindow: number, settings: CompactionSettings) {
  return settings.enabled && contextTokens > contextWindow - settings.reserveTokens;
}

export function calculateContextTokens(usage: Usage) {
  return usage.totalTokens || usage.input + usage.output + usage.cacheRead + usage.cacheWrite;
}

/** Rough token estimate: chars / 4. */
export function estimateTokens(message: HarnessMessage): number {
  return Math.ceil(messageText(message).length / 4);
}

/**
 * Estimate context size: the last assistant message's reported usage plus an
 * estimate of everything after it.
 */
export function estimateContextTokens(messages: HarnessMessage[]): number {
  let lastIndex = -1;
  let base = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === 'assistant' && m.stopReason !== 'error' && m.stopReason !== 'aborted' && m.usage?.totalTokens) {
      lastIndex = i;
      base = calculateContextTokens(m.usage);
      break;
    }
  }
  let trailing = 0;
  for (let i = lastIndex + 1; i < messages.length; i++) {
    trailing += estimateTokens(messages[i]);
  }
  if (lastIndex < 0) {
    return messages.reduce((a, m) => a + estimateTokens(m), 0);
  }
  return base + trailing;
}

/**
 * Index of the first message to keep verbatim. Walks back from the end until
 * `keepRecentTokens` is reached, and never cuts at a tool result (so a tool
 * result is never separated from the assistant message that called it).
 * Returns 0 when there is nothing worth compacting.
 */
export function findCutPoint(messages: HarnessMessage[], keepRecentTokens: number): number {
  let tokens = 0;
  let cut = messages.length;
  for (let i = messages.length - 1; i >= 0; i--) {
    tokens += estimateTokens(messages[i]);
    cut = i;
    if (tokens >= keepRecentTokens) break;
  }
  while (cut > 0 && cut < messages.length && messages[cut].role === 'toolResult') {
    cut -= 1;
  }
  return cut;
}

export type Summarize = (conversation: string, previousSummary?: string, signal?: AbortSignal) => Promise<string>;

export interface CompactionResult {
  messages: HarnessMessage[];
  summary: CustomMessage;
  firstKeptIndex: number;
  tokensBefore: number;
}

/**
 * Replace older history with a summary message. Returns undefined when there
 * is nothing to compact.
 */
export async function compact(
  messages: HarnessMessage[],
  settings: CompactionSettings,
  summarize: Summarize,
  signal?: AbortSignal,
): Promise<CompactionResult | undefined> {
  const cut = findCutPoint(messages, settings.keepRecentTokens);
  if (cut <= 0) return undefined;
  const older = messages.slice(0, cut);
  const previous = older.find(
    (m): m is CustomMessage => m.role === 'custom' && m.customType === COMPACTION_SUMMARY_TYPE
  );
  const toSummarize = older.filter((m) => m !== previous);
  const text = await summarize(serializeConversation(toSummarize), previous?.content, signal);
  const summary: CustomMessage = {
    role: 'custom',
    customType: COMPACTION_SUMMARY_TYPE,
    content: text,
    timestamp: Date.now(),
  };
  return {
    messages: [summary, ...messages.slice(cut)],
    summary,
    firstKeptIndex: cut,
    tokensBefore: estimateContextTokens(messages),
  };
}

export const SUMMARY_PROMPT = `You are summarizing an agent conversation so it can continue with less context.
Write a concise markdown summary with these sections:

## Goal
## Constraints & Preferences
## Progress
## Key Decisions
## Next Steps
## Critical Context

Preserve exact identifiers, numbers, and tool results that later steps depend on.`;

/** Wraps a compaction summary as a user message for the model. */
export function summaryToLlm(message: CustomMessage): LlmMessage {
  return {
    role: 'user',
    content:
      'The conversation history before this point was compacted into the following summary:\n\n' +
      `<summary>\n${message.content}\n</summary>`,
    timestamp: message.timestamp,
  };
}

const TOOL_RESULT_MAX_CHARS = 2000;

export function serializeConversation(messages: HarnessMessage[]): string {
  const lines: string[] = [];
  for (const m of messages) {
    switch (m.role) {
      case 'user':
        lines.push(`[User]: ${messageText(m)}`);
        break;
      case 'assistant': {
        const text = m.content.filter((c) => c.type === 'text').map((c: any) => c.text).join('\n');
        if (text) lines.push(`[Assistant]: ${text}`);
        const calls = m.content.filter((c) => c.type === 'toolCall') as any[];
        if (calls.length) {
          lines.push(`[Assistant tool calls]: ${calls.map((c) => `${c.name}(${JSON.stringify(c.arguments)})`).join('; ')}`);
        }
        break;
      }
      case 'toolResult': {
        let text = messageText(m);
        if (text.length > TOOL_RESULT_MAX_CHARS) {
          text = text.slice(0, TOOL_RESULT_MAX_CHARS) + '… [truncated]';
        }
        lines.push(`[Tool result ${m.toolName}]: ${text}`);
        break;
      }
      case 'custom':
        lines.push(`[${m.customType}]: ${m.content}`);
        break;
    }
  }
  return lines.join('\n\n');
}

function messageText(m: HarnessMessage): string {
  if (m.role === 'custom') return m.content;
  const content: any = m.content;
  if (typeof content === 'string') return content;
  return (content as any[])
    .map((c) => {
      if (c.type === 'text') return c.text;
      if (c.type === 'thinking') return c.thinking;
      if (c.type === 'toolCall') return `${c.name} ${JSON.stringify(c.arguments)}`;
      return '';
    })
    .join('\n');
}
