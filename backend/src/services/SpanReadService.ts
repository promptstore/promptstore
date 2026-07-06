import { Span, SpanNode } from '../core/telemetry/canonical';
import { SpanStore } from './spanstore/SpanStore';

// Reconstructs the trace tree from flat spans on read. Returns both the flat
// span list (for the frontend's normalized-by-span_id store) and the assembled
// root nodes (for convenience / server-side consumers).

export function SpanReadService({ logger, spanStore }: { logger: any; spanStore: SpanStore }) {

  function buildTree(spans: Span[]): SpanNode[] {
    const byId = new Map<string, SpanNode>();
    for (const s of spans) {
      byId.set(s.span_id, { ...s, children: [] });
    }
    const roots: SpanNode[] = [];
    for (const node of byId.values()) {
      const parentId = node.parent_span_id;
      if (parentId && byId.has(parentId)) {
        byId.get(parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    // stable order by start_time within each level
    const sortRec = (nodes: SpanNode[]) => {
      nodes.sort((a, b) => (a.start_time < b.start_time ? -1 : a.start_time > b.start_time ? 1 : 0));
      nodes.forEach(n => sortRec(n.children));
    };
    sortRec(roots);
    return roots;
  }

  function summarize(spans: Span[]) {
    let running = false;
    let promptTokens = 0, completionTokens = 0, cachedTokens = 0, totalTokens = 0, cost = 0;
    let turns = 0, toolCalls = 0;
    let root: Span | undefined;
    for (const s of spans) {
      if (!s.parent_span_id) root = root || s;
      if (!s.end_time) running = true;
      if (s.span_kind === 'loop.iteration') turns++;
      if (s.span_kind === 'tool.call') toolCalls++;
      const u = s.usage || {};
      promptTokens += u.prompt_tokens || 0;
      completionTokens += u.completion_tokens || 0;
      cachedTokens += u.cached_tokens || 0;
      totalTokens += u.total_tokens || 0;
      cost += s.cost_total || 0;
    }
    return {
      name: root?.name || null,
      status: root?.status || 'unset',
      running,
      turns,
      tool_calls: toolCalls,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      cached_tokens: cachedTokens,
      total_tokens: totalTokens,
      cost_total: cost,
    };
  }

  async function getTrace(workspaceId: number, traceId: string, opts: { sinceSeq?: number } = {}) {
    const spans = await spanStore.getSpans(workspaceId, traceId, opts);
    return {
      trace_id: traceId,
      spans,
      roots: buildTree(spans),
      summary: summarize(spans),
    };
  }

  return { getTrace, buildTree };
}
