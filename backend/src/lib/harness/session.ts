import { randomUUID } from 'crypto';

import type { HarnessMessage } from './types';

/**
 * Append-only session tree (after pi's JSONL session format). Every entry has
 * a parent; the "leaf" is the current position. Branching moves the leaf to
 * an earlier entry so new entries fork from there.
 */
export type SessionEntry =
  | BaseEntry<'message', { message: HarnessMessage }>
  | BaseEntry<'compaction', { summary: HarnessMessage; firstKeptEntryId: string; tokensBefore: number }>
  | BaseEntry<'model_change', { provider?: string; model: string }>
  | BaseEntry<'custom', { customType: string; data: any }>;

type BaseEntry<T extends string, D> = {
  type: T;
  id: string;
  parentId: string | null;
  timestamp: string;
} & D;

export type NewSessionEntry = SessionEntry extends infer E
  ? E extends SessionEntry ? Omit<E, 'id' | 'parentId' | 'timestamp'> : never
  : never;

export interface SessionContext {
  messages: HarnessMessage[];
  model?: { provider?: string; model: string };
}

export interface SessionStore {
  getLeafId(sessionId: string): Promise<string | null>;
  /** Append an entry as a child of the current leaf and move the leaf to it. */
  append(sessionId: string, entry: NewSessionEntry): Promise<SessionEntry>;
  getEntries(sessionId: string): Promise<SessionEntry[]>;
  /** Move the leaf so new entries fork from `entryId` (null = root). */
  branch(sessionId: string, entryId: string | null): Promise<void>;
}

export function newEntryId() {
  return randomUUID().replace(/-/g, '').slice(0, 16);
}

/** Path from the root to `leafId`. */
export function getBranch(entries: SessionEntry[], leafId: string | null): SessionEntry[] {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const path: SessionEntry[] = [];
  let cur = leafId ? byId.get(leafId) : undefined;
  while (cur) {
    path.push(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return path.reverse();
}

/**
 * Rebuild the model context for the branch ending at `leafId`. With a
 * compaction on the path, the context is the summary, then the kept messages
 * from `firstKeptEntryId`, then everything after the compaction.
 */
export function buildSessionContext(entries: SessionEntry[], leafId: string | null): SessionContext {
  const path = getBranch(entries, leafId);
  let model: SessionContext['model'];
  let compactionIndex = -1;
  for (let i = 0; i < path.length; i++) {
    const e = path[i];
    if (e.type === 'compaction') compactionIndex = i;
    if (e.type === 'model_change') model = { provider: e.provider, model: e.model };
  }
  const messages: HarnessMessage[] = [];
  if (compactionIndex >= 0) {
    const c = path[compactionIndex] as Extract<SessionEntry, { type: 'compaction' }>;
    messages.push(c.summary);
    const keptStart = path.findIndex((e) => e.id === c.firstKeptEntryId);
    if (keptStart >= 0 && keptStart < compactionIndex) {
      for (const e of path.slice(keptStart, compactionIndex)) {
        if (e.type === 'message') messages.push(e.message);
      }
    }
    for (const e of path.slice(compactionIndex + 1)) {
      if (e.type === 'message') messages.push(e.message);
    }
  } else {
    for (const e of path) {
      if (e.type === 'message') messages.push(e.message);
    }
  }
  return { messages, model };
}

export class InMemorySessionStore implements SessionStore {

  private sessions = new Map<string, { entries: SessionEntry[]; leafId: string | null }>();

  private get(sessionId: string) {
    let s = this.sessions.get(sessionId);
    if (!s) {
      s = { entries: [], leafId: null };
      this.sessions.set(sessionId, s);
    }
    return s;
  }

  async getLeafId(sessionId: string) {
    return this.get(sessionId).leafId;
  }

  async append(sessionId: string, entry: NewSessionEntry): Promise<SessionEntry> {
    const s = this.get(sessionId);
    const full = {
      ...entry,
      id: newEntryId(),
      parentId: s.leafId,
      timestamp: new Date().toISOString(),
    } as SessionEntry;
    s.entries.push(full);
    s.leafId = full.id;
    return full;
  }

  async getEntries(sessionId: string) {
    return [...this.get(sessionId).entries];
  }

  async branch(sessionId: string, entryId: string | null) {
    const s = this.get(sessionId);
    if (entryId && !s.entries.some((e) => e.id === entryId)) {
      throw new Error(`Unknown entry ${entryId}`);
    }
    s.leafId = entryId;
  }
}

/** Load the context for a session's current leaf. */
export async function loadSessionContext(store: SessionStore, sessionId: string): Promise<SessionContext> {
  const [entries, leafId] = await Promise.all([store.getEntries(sessionId), store.getLeafId(sessionId)]);
  return buildSessionContext(entries, leafId);
}
