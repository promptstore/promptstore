import { createSelector, createSlice } from '@reduxjs/toolkit';
import qs from 'qs';

import { http } from '../../http';

// Normalized store for harness spans. A trace is held as spans keyed by
// span_id so live updates (Phase 2) patch entities in place; the tree is a
// pure selector over that map. `mode` is 'completed' | 'running'.

export const harnessTracesSlice = createSlice({
  name: 'harnessTraces',
  initialState: {
    count: 0,
    loading: false,
    loaded: false,
    list: [],                 // trace summaries for the list view
    current: {
      traceId: null,
      spans: {},              // span_id -> span
      selectedSpanId: null,
      mode: 'completed',
      lastSeq: -1,
      summary: null,
      loading: false,
      tailing: true,          // live-tail: auto-follow newest span
      payloads: {},           // span_id -> { loading, content, error } (lazy content)
    },
  },
  reducers: {
    startListLoad: (state) => { state.loading = true; state.loaded = false; },
    setList: (state, action) => {
      state.list = action.payload.data;
      state.count = action.payload.count;
      state.loading = false;
      state.loaded = true;
    },
    startTraceLoad: (state, action) => {
      const { traceId } = action.payload;
      if (state.current.traceId !== traceId) {
        state.current = {
          traceId,
          spans: {},
          selectedSpanId: null,
          mode: 'completed',
          lastSeq: -1,
          summary: null,
          loading: true,
          tailing: true,
          payloads: {},
        };
      } else {
        state.current.loading = true;
      }
    },
    setTraceSpans: (state, action) => {
      const { spans, summary } = action.payload;
      const byId = {};
      let lastSeq = state.current.lastSeq;
      for (const s of spans) {
        byId[s.span_id] = s;
        if (s.seq != null && s.seq > lastSeq) lastSeq = s.seq;
      }
      state.current.spans = byId;
      state.current.summary = summary;
      state.current.lastSeq = lastSeq;
      state.current.mode = summary && summary.running ? 'running' : 'completed';
      state.current.loading = false;
      if (!state.current.selectedSpanId) {
        // default-select the root span
        const root = spans.find(s => !s.parent_span_id);
        state.current.selectedSpanId = root ? root.span_id : (spans[0] && spans[0].span_id) || null;
      }
    },
    // Incremental patch used by the live stream and polling fallback.
    upsertSpans: (state, action) => {
      let newestSpan = null;
      for (const s of action.payload.spans) {
        const existing = state.current.spans[s.span_id];
        state.current.spans[s.span_id] = existing ? { ...existing, ...s } : s;
        if (s.seq != null && s.seq > state.current.lastSeq) state.current.lastSeq = s.seq;
        if (!newestSpan || (s.start_time || '') > (newestSpan.start_time || '')) newestSpan = s;
      }
      // derive running from whether any span is still open
      const running = Object.values(state.current.spans).some(s => !s.end_time);
      state.current.mode = running ? 'running' : 'completed';
      // live-tail: follow the newest span
      if (state.current.tailing && newestSpan) {
        state.current.selectedSpanId = newestSpan.span_id;
      }
    },
    selectSpan: (state, action) => {
      // manual selection stops tailing (log-tail affordance)
      state.current.selectedSpanId = action.payload;
      state.current.tailing = false;
    },
    setTailing: (state, action) => {
      state.current.tailing = action.payload;
    },
    setPayload: (state, action) => {
      const { spanId, ...rest } = action.payload;
      state.current.payloads[spanId] = { ...state.current.payloads[spanId], ...rest };
    },
  },
});

export const {
  startListLoad,
  setList,
  startTraceLoad,
  setTraceSpans,
  upsertSpans,
  selectSpan,
  setTailing,
  setPayload,
} = harnessTracesSlice.actions;

export const listHarnessTracesAsync = ({ workspaceId, limit = 50, start = 0, filters = {} }) => async (dispatch) => {
  dispatch(startListLoad());
  const url = `/api/workspaces/${workspaceId}/harness-traces?limit=${limit}&start=${start}&${qs.stringify(filters)}`;
  const res = await http.get(url);
  dispatch(setList({ data: res.data.data, count: res.data.count }));
};

export const deleteHarnessTracesAsync = ({ workspaceId, traceIds, limit = 50, start = 0, filters = {} }) => async (dispatch) => {
  await http.post(`/api/workspaces/${workspaceId}/harness-traces/delete`, { traceIds });
  // Refetch the current page so counts and rows reflect the deletion.
  const url = `/api/workspaces/${workspaceId}/harness-traces?limit=${limit}&start=${start}&${qs.stringify(filters)}`;
  const res = await http.get(url);
  dispatch(setList({ data: res.data.data, count: res.data.count }));
};

export const getHarnessTraceAsync = ({ workspaceId, traceId, sinceSeq }) => async (dispatch) => {
  dispatch(startTraceLoad({ traceId }));
  let url = `/api/workspaces/${workspaceId}/harness-traces/${traceId}`;
  if (sinceSeq != null) url += `?since=${sinceSeq}`;
  const res = await http.get(url);
  dispatch(setTraceSpans({ spans: res.data.spans || [], summary: res.data.summary }));
};

// Lazily fetch a span's captured content (model/tool input & output). Cached by
// span_id; only fetched for spans that carry a payload_ref.
export const getSpanPayloadAsync = ({ workspaceId, traceId, spanId }) => async (dispatch, getState) => {
  const existing = getState().harnessTraces.current.payloads[spanId];
  // Skip if already loading, already loaded, or already resolved to an error —
  // an errored fetch leaves content undefined, so guarding on content alone
  // would let a re-selected no-content span re-fetch on every pass.
  if (existing && (existing.loading || existing.content !== undefined || existing.error)) return;
  dispatch(setPayload({ spanId, loading: true, error: null }));
  try {
    const url = `/api/workspaces/${workspaceId}/harness-traces/${traceId}/spans/${spanId}/payload`;
    const res = await http.get(url);
    dispatch(setPayload({ spanId, loading: false, content: res.data.content }));
  } catch (err) {
    dispatch(setPayload({ spanId, loading: false, error: err.response?.status === 404 ? 'no content captured' : 'failed to load content' }));
  }
};

// ---- live streaming (SSE + polling fallback, mirrors agentsSlice.listen) ----
const MAX_RETRY_COUNT = 3;
let traceEvents;          // active per-trace EventSource
let tracePollInterval;    // active polling-fallback interval
let wsEvents;             // active workspace-feed EventSource

const stopTracePolling = () => {
  if (tracePollInterval) { clearInterval(tracePollInterval); tracePollInterval = null; }
};

// Coalesce live span frames into one dispatch per animation frame. A running
// trace publishes one SSE message per ingested span, and EventSource drains a
// backlog burst as many onmessage events inside a single task. Dispatching per
// message would fan out one full re-render (tree + waterfall + selection +
// payload fetch) for every span in the burst — React counts that cascade as
// nested updates and throws "Maximum update depth exceeded". Buffering here
// collapses a burst into a single upsertSpans, bounding re-renders to the frame
// rate regardless of how fast the stream arrives.
let spanBuffer = [];
let flushHandle = null;
const scheduleFlush = (dispatch) => {
  if (flushHandle != null) return;
  const flush = () => {
    flushHandle = null;
    if (!spanBuffer.length) return;
    const spans = spanBuffer;
    spanBuffer = [];
    dispatch(upsertSpans({ spans }));
  };
  flushHandle = (typeof requestAnimationFrame === 'function')
    ? requestAnimationFrame(flush)
    : setTimeout(flush, 16);
};
const bufferSpans = (spans, dispatch) => {
  if (!spans || !spans.length) return;
  spanBuffer.push(...spans);
  scheduleFlush(dispatch);
};
const cancelFlush = () => {
  if (flushHandle != null) {
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(flushHandle);
    else clearTimeout(flushHandle);
    flushHandle = null;
  }
  spanBuffer = [];
};

const listenTrace = (workspaceId, traceId, token, dispatch, getState, retries = 0) => {
  traceEvents = new EventSource(`/v1/telemetry/traces/${traceId}/stream?token=${encodeURIComponent(token)}`);
  traceEvents.onmessage = (event) => {
    try {
      const span = JSON.parse(event.data);
      bufferSpans([span], dispatch);
    } catch (err) { /* ignore heartbeats / malformed */ }
  };
  traceEvents.onerror = () => {
    traceEvents.close();
    if (retries < MAX_RETRY_COUNT) {
      setTimeout(() => listenTrace(workspaceId, traceId, token, dispatch, getState, retries + 1), 1000);
    } else {
      // fall back to incremental polling until the trace completes or 120s idle
      const timeout = 120000;
      const start = Date.now();
      stopTracePolling();
      tracePollInterval = setInterval(async () => {
        try {
          const sinceSeq = getState().harnessTraces.current.lastSeq;
          const url = `/api/workspaces/${workspaceId}/harness-traces/${traceId}?since=${sinceSeq}`;
          const res = await http.get(url);
          if (res.data.spans && res.data.spans.length) {
            bufferSpans(res.data.spans, dispatch);
          }
          const running = res.data.summary && res.data.summary.running;
          if (!running || Date.now() - start > timeout) stopTracePolling();
        } catch (err) {
          stopTracePolling();
        }
      }, 5000);
    }
  };
};

export const subscribeTraceAsync = ({ workspaceId, traceId }) => async (dispatch, getState) => {
  // seed with a full snapshot, then attach the live tail
  await dispatch(getHarnessTraceAsync({ workspaceId, traceId }));
  try {
    const res = await http.post(`/api/workspaces/${workspaceId}/harness-traces/${traceId}/stream-token`);
    const { token } = res.data;
    listenTrace(workspaceId, traceId, token, dispatch, getState);
  } catch (err) {
    // no live stream available — the snapshot still rendered; leave as-is
    console.warn('harness live subscribe failed; showing snapshot only', err);
  }
};

export const unsubscribeTrace = () => () => {
  if (traceEvents) { try { traceEvents.close(); } catch (e) { /* ignore */ } traceEvents = null; }
  stopTracePolling();
  cancelFlush();
};

// Workspace feed: invokes onTouch(parsedEvent) for each run-touch. The caller
// (list view) debounces a refetch. Returns nothing; use unsubscribeWorkspace().
export const subscribeWorkspaceAsync = ({ workspaceId, onTouch }) => async () => {
  try {
    const res = await http.post(`/api/workspaces/${workspaceId}/harness-stream-token`);
    const { token } = res.data;
    wsEvents = new EventSource(`/v1/telemetry/workspaces/${workspaceId}/stream?token=${encodeURIComponent(token)}`);
    wsEvents.onmessage = (event) => {
      try { onTouch(JSON.parse(event.data)); } catch (e) { /* ignore */ }
    };
    wsEvents.onerror = () => { if (wsEvents) { wsEvents.close(); wsEvents = null; } };
  } catch (err) {
    console.warn('harness workspace feed subscribe failed', err);
  }
};

export const unsubscribeWorkspace = () => () => {
  if (wsEvents) { try { wsEvents.close(); } catch (e) { /* ignore */ } wsEvents = null; }
};

// ---- selectors ----
export const selectHarnessList = (state) => state.harnessTraces.list;
export const selectHarnessCount = (state) => state.harnessTraces.count;
export const selectHarnessLoading = (state) => state.harnessTraces.loading;
export const selectCurrentTrace = (state) => state.harnessTraces.current;
export const selectSelectedSpanId = (state) => state.harnessTraces.current.selectedSpanId;

export const selectSelectedSpan = (state) => {
  const { spans, selectedSpanId } = state.harnessTraces.current;
  return selectedSpanId ? spans[selectedSpanId] : null;
};

export const selectTailing = (state) => state.harnessTraces.current.tailing;
export const selectPayload = (spanId) => (state) => state.harnessTraces.current.payloads[spanId];
export const selectIsRunning = (state) =>
  Object.values(state.harnessTraces.current.spans).some(s => !s.end_time);

// Derive the agent topology of the current trace: one node per agent-level span
// (harness.run + subagent.spawn). Token/cost is partitioned by "owner" — the
// nearest agent-level ancestor (including self) — so each agent's stats reflect
// its own work, excluding nested sub-agents. Edges connect an agent to the
// nearest agent-level proper ancestor. A subagent.spawn that links to a separate
// child trace carries childTraceId for drill-down navigation.
const AGENT_KINDS = new Set(['harness.run', 'subagent.spawn']);

// Base input for the derived-view selectors. The derived selectors below are
// memoized on this map's identity (immer only produces a new reference when a
// span actually changes) — without memoization they return a fresh array on
// every store notification, which re-renders the views and forces Highcharts /
// reactflow to redraw with no actual change.
const selectSpansMap = (state) => state.harnessTraces.current.spans;

export const selectSubAgentGraph = createSelector([selectSpansMap], (spansMap) => {
  const spans = Object.values(spansMap);
  const isAgent = (s) => AGENT_KINDS.has(s.span_kind);

  // nearest agent-level ancestor including self
  const ownerOf = (span) => {
    let cur = span;
    while (cur) {
      if (isAgent(cur)) return cur.span_id;
      cur = cur.parent_span_id ? spansMap[cur.parent_span_id] : null;
    }
    return null;
  };
  // nearest agent-level PROPER ancestor (for parent edges)
  const parentAgentOf = (span) => {
    let cur = span.parent_span_id ? spansMap[span.parent_span_id] : null;
    while (cur) {
      if (isAgent(cur)) return cur.span_id;
      cur = cur.parent_span_id ? spansMap[cur.parent_span_id] : null;
    }
    return null;
  };

  const agents = {};
  for (const s of spans) {
    if (!isAgent(s)) continue;
    const spawnsLink = (s.links || []).find(l => l.rel === 'spawns');
    agents[s.span_id] = {
      id: s.span_id,
      label: s.name || s.span_kind,
      kind: s.span_kind,
      status: s.status,
      running: !s.end_time,
      childTraceId: spawnsLink ? spawnsLink.trace_id : null,
      parentId: parentAgentOf(s),
      startTime: s.start_time,
      durationMs: s.end_time ? new Date(s.end_time).getTime() - new Date(s.start_time).getTime() : null,
      tokens: 0,
      cost: 0,
    };
  }
  // aggregate work into its owning agent
  for (const s of spans) {
    const owner = ownerOf(s);
    if (owner && agents[owner]) {
      agents[owner].tokens += (s.usage && s.usage.total_tokens) || 0;
      agents[owner].cost += s.cost_total || 0;
    }
  }
  return Object.values(agents);
});

// Build the span tree from the normalized map (pure derivation, memoized).
export const selectSpanTree = createSelector([selectSpansMap], (spansMap) => {
  const spans = Object.values(spansMap);
  const byId = {};
  for (const s of spans) byId[s.span_id] = { ...s, children: [] };
  const roots = [];
  for (const node of Object.values(byId)) {
    if (node.parent_span_id && byId[node.parent_span_id]) {
      byId[node.parent_span_id].children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortRec = (nodes) => {
    nodes.sort((a, b) => (a.start_time < b.start_time ? -1 : a.start_time > b.start_time ? 1 : 0));
    nodes.forEach(n => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
});

// Derive the context-lifecycle timeline: every ps.context.* event across the
// trace, in ingest order, each resolved to a full window composition snapshot.
// If an event carries sources[], that IS the composition; otherwise the previous
// composition is carried forward, scaled to the event's reported window total
// (marked `carried: true` so the UI can say so). Each event is attributed to its
// owning turn (nearest loop.iteration ancestor, incl. self) and agent (nearest
// harness.run/subagent.spawn ancestor) so the user always knows where they are
// in the overall flow.
const CONTEXT_EVENT_KIND = {
  'ps.context.assemble': 'assemble',
  'ps.context.retrieve': 'retrieve',
  'ps.context.compact': 'compact',
  'ps.context.evict': 'evict',
};

export const selectContextTimeline = createSelector([selectSpansMap], (spansMap) => {
  const spans = Object.values(spansMap)
    .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0) || (a.start_time < b.start_time ? -1 : 1));

  const isAgentSpan = (s) => s.span_kind === 'harness.run' || s.span_kind === 'subagent.spawn';
  const nearest = (span, pred, { stopAtAgent = false } = {}) => {
    let cur = span;
    while (cur) {
      if (pred(cur)) return cur;
      // turn attribution must not leak across an agent boundary — a sub-agent's
      // context op belongs to that agent, not the spawning agent's turn
      if (stopAtAgent && isAgentSpan(cur) && cur !== span) return null;
      cur = cur.parent_span_id ? spansMap[cur.parent_span_id] : null;
    }
    return null;
  };

  const events = [];
  for (const span of spans) {
    for (const ev of span.events || []) {
      const kind = CONTEXT_EVENT_KIND[ev.name];
      if (!kind) continue;
      events.push({ span, ev, kind });
    }
  }
  events.sort((a, b) => ((a.ev.time || '') < (b.ev.time || '') ? -1 : 1));

  let lastComposition = null;
  let turnCounter = 0;
  const seenTurns = new Map();   // loop span_id -> turn ordinal

  return events.map(({ span, ev, kind }, index) => {
    const p = ev.attributes || {};
    const loop = nearest(span, s => s.span_kind === 'loop.iteration', { stopAtAgent: true });
    const agent = nearest(span, isAgentSpan);
    if (loop && !seenTurns.has(loop.span_id)) seenTurns.set(loop.span_id, turnCounter++);
    const turn = loop ? seenTurns.get(loop.span_id) : null;

    const total = p.window_tokens_after ?? null;
    let composition = null;
    let carried = false;
    if (Array.isArray(p.sources) && p.sources.length) {
      composition = p.sources.map(s => ({ source: s.source, tokens: s.tokens || 0, label: s.label, preview: s.preview }));
    } else if (lastComposition && total != null) {
      const prevTotal = lastComposition.reduce((a, s) => a + s.tokens, 0) || 1;
      composition = lastComposition.map(s => ({ ...s, tokens: Math.round(s.tokens * (total / prevTotal)) }));
      carried = true;
    } else if (total != null) {
      composition = [{ source: 'unattributed', tokens: total }];
      carried = true;
    }
    if (composition) lastComposition = composition;

    return {
      index,
      kind,                                    // assemble | retrieve | compact | evict
      time: ev.time,
      spanId: span.span_id,
      turn,
      turnLabel: loop ? (loop.name || `turn-${turn}`) : null,
      agentLabel: agent ? (agent.name || agent.span_kind) : null,
      payload: p,
      composition: composition || [],
      total: total ?? (composition ? composition.reduce((a, s) => a + s.tokens, 0) : null),
      limit: p.window_limit ?? null,
      carried,
    };
  });
});

export default harnessTracesSlice.reducer;
