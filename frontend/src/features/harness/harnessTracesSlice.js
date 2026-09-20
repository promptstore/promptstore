import { createSelector, createSlice } from '@reduxjs/toolkit';
import qs from 'qs';

import { http } from '../../http';

// The server's ingest cursor, falling back to the emitter's counter only where
// there is no server one to read (see the note above).
const cursorOf = (span) => (span.ingest_seq != null ? span.ingest_seq : span.seq);

// Normalized store for harness spans. A trace is held as spans keyed by
// span_id so live updates (Phase 2) patch entities in place; the tree is a
// pure selector over that map. `mode` is 'completed' | 'running'.
//
// `lastSeq` is the incremental cursor the poll and the SSE resume are driven
// from, and it reads `ingest_seq`, the server's. The SDK's `seq` is a
// per-process counter — a run written by two replicas, or by one process either
// side of a restart, reports several of them over one trace — so a cursor built
// from it goes backwards and the tail silently stops delivering. `seq` is only
// the fallback for a span from a store too old to carry a cursor.

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
        const cursor = cursorOf(s);
        if (cursor != null && cursor > lastSeq) lastSeq = cursor;
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
        const cursor = cursorOf(s);
        if (cursor != null && cursor > state.current.lastSeq) state.current.lastSeq = cursor;
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

// --- shared span-walking helpers (context timeline + decision tree) ---------
// Run order: start_time is the clock the span was opened on; seq breaks ties
// between spans opened in the same instant.
//
// seq deliberately does NOT lead. It is assigned by the SDK from a counter held
// on the client *instance*, so it is monotonic per emitting process, not per
// trace: a conversation served by more than one replica — or by one process
// either side of a restart — carries several counters that each begin again at
// zero. Leading on it scrambles the turns of any such trace, which is what put
// a conversation's closing turn at the top of the decision tree and attached
// each answer to somebody else's question.
const cmpTime = (a, b) => {
  const x = a.start_time || '';
  const y = b.start_time || '';
  return x < y ? -1 : x > y ? 1 : 0;
};

const spansInOrder = (spansMap) => Object.values(spansMap)
  .sort((a, b) => cmpTime(a, b) || (cursorOf(a) ?? 0) - (cursorOf(b) ?? 0));

const isAgentSpan = (s) => s.span_kind === 'harness.run' || s.span_kind === 'subagent.spawn';

// Nearest ancestor (including self) satisfying pred. With stopAtAgent, the walk
// refuses to cross an agent boundary — a sub-agent's event belongs to that
// agent, not to the spawning agent's turn.
const nearestAncestor = (spansMap, span, pred, { stopAtAgent = false } = {}) => {
  let cur = span;
  while (cur) {
    if (pred(cur)) return cur;
    if (stopAtAgent && isAgentSpan(cur) && cur !== span) return null;
    cur = cur.parent_span_id ? spansMap[cur.parent_span_id] : null;
  }
  return null;
};

const isLoopSpan = (s) => s.span_kind === 'loop.iteration';

// Turn ordinals are assigned by the order the turn spans ran rather than read
// off the span, so a trace whose turn spans are named or indexed differently
// still numbers its turns 0..n.
//
// Numbered over the loop spans themselves, not over whichever span happened to
// carry a turn's first interesting event: a turn whose events all sit on a
// nested span is still that turn, and a turn that emits nothing at all still
// takes its place in the count rather than shifting every later turn down one.
const turnOrdinals = (spansMap) => {
  const order = new Map();
  Object.values(spansMap)
    .filter(isLoopSpan)
    .sort((a, b) => cmpTime(a, b) || (cursorOf(a) ?? 0) - (cursorOf(b) ?? 0) || (a.span_id < b.span_id ? -1 : 1))
    .forEach((loop, i) => order.set(loop.span_id, i));
  return (loop) => {
    if (!loop) return null;
    const ordinal = order.get(loop.span_id);
    return ordinal == null ? null : ordinal;
  };
};

export const selectContextTimeline = createSelector([selectSpansMap], (spansMap) => {
  const spans = spansInOrder(spansMap);

  const nearest = (span, pred, opts) => nearestAncestor(spansMap, span, pred, opts);

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
  const ordinalOf = turnOrdinals(spansMap);

  return events.map(({ span, ev, kind }, index) => {
    const p = ev.attributes || {};
    const loop = nearest(span, isLoopSpan, { stopAtAgent: true });
    const agent = nearest(span, isAgentSpan);
    const turn = ordinalOf(loop);

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

// --- the decision tree ------------------------------------------------------
// A conversational harness puts a step to the user, offers a set of options,
// and the reply takes one of them — or an implicit "other" branch when it
// matches none. Chained turn by turn, that is the path the conversation walked.
//
// Two event kinds drive it, and the pairing is the only subtle part:
//   ps.decision.point  — emitted on the turn that ASKED; the turn's last point
//                        is the live question (earlier ones are narration).
//   ps.decision.choice — emitted on the turn that ANSWERED, i.e. turn n's
//                        choice resolves turn n-1's step.
// A choice repeats the offer it resolved, so a step whose point never reached
// the trace (an opening message written outside any turn) is still drawn — from
// the choice alone.
const DECISION_POINT = 'ps.decision.point';
const DECISION_CHOICE = 'ps.decision.choice';

//: The branch a reply takes when it matches none of the options on offer.
export const OTHER_BRANCH = '__other__';

// Matches that name the branch outright. 'none' belongs here: it is a definite
// statement that the reply matched nothing, which is how Other is *reached*,
// not a guess about it. Anything else — contains/fuzzy, or a tier this UI has
// never heard of — is drawn as inferred.
const DEFINITE_MATCHES = new Set(['exact', 'normalized', 'translated', 'synonym', 'none']);

export const selectDecisionTree = createSelector([selectSpansMap], (spansMap) => {
  const ordinalOf = turnOrdinals(spansMap);

  // turn ordinal -> { spanId, points: [], choice }
  const turns = new Map();
  const turnOf = (span) => {
    const loop = nearestAncestor(spansMap, span, isLoopSpan, { stopAtAgent: true });
    const ordinal = ordinalOf(loop);
    if (ordinal == null) return null;
    if (!turns.has(ordinal)) turns.set(ordinal, { turn: ordinal, spanId: loop.span_id, points: [], choice: null });
    return turns.get(ordinal);
  };

  for (const span of spansInOrder(spansMap)) {
    for (const ev of span.events || []) {
      if (ev.name !== DECISION_POINT && ev.name !== DECISION_CHOICE) continue;
      const entry = turnOf(span);
      if (!entry) continue;
      // Keyed by the event's own clock, not the span's: which of a turn's
      // points was the live one is decided by the last one *emitted*, and a
      // turn's events can arrive spread over the turn span and its children.
      if (ev.name === DECISION_POINT) entry.points.push({ time: ev.time || '', attributes: ev.attributes || {} });
      else entry.choice = ev.attributes || {};
    }
  }
  for (const entry of turns.values()) {
    entry.points.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
  }

  const steps = [];

  const openStep = ({ turn, spanId, options, optionsEn, allowsFreeText, step, question, messageType, reconstructed }) => {
    const entry = {
      id: `s${steps.length}`,
      turn,
      spanId,
      step: step || 'step',
      question: question || null,
      messageType: messageType || null,
      reconstructed: !!reconstructed,
      pending: true,
      answered: false,
      inferred: false,
      branches: (options || []).map((label, index) => ({
        key: `s${steps.length}:${index}`,
        label,
        labelEn: (optionsEn || [])[index],
        other: false,
        taken: false,
      })),
    };
    if (allowsFreeText !== false) {
      // Just "Other": how the reply arrived — tapped or typed — is not a
      // distinction this tree draws, so naming it on the branch (and in the
      // path summary built from these labels) says something that isn't there.
      entry.branches.push({ key: `s${steps.length}:other`, label: 'Other', other: true, taken: false });
    }
    steps.push(entry);
    return entry;
  };

  const answer = (entry, choice) => {
    entry.pending = false;
    entry.answered = true;
    entry.inferred = !!choice.match && !DEFINITE_MATCHES.has(choice.match);
    const other = entry.branches.find(b => b.other);
    if (choice.branch === OTHER_BRANCH) {
      if (other) {
        other.taken = true;
        other.preview = choice.reply_preview || null;
        other.ambiguous = !!choice.ambiguous;
      }
      return;
    }
    const hit = entry.branches.find((b, i) =>
      !b.other && (choice.branch_index === i || (choice.branch_index == null && b.label === choice.branch)));
    if (hit) hit.taken = true;
  };

  for (const entry of [...turns.values()].sort((a, b) => a.turn - b.turn)) {
    // A choice is emitted on the turn that ANSWERED, so it resolves the step
    // still waiting for an answer. There may not be one: an opening message is
    // written outside any turn, so its point event never reached the trace and
    // the first choice has nothing to attach to. The choice echoes the offer it
    // resolved precisely so that step can be rebuilt here rather than lost.
    if (entry.choice) {
      const pending = steps.length && steps[steps.length - 1].pending ? steps[steps.length - 1] : null;
      const target = pending || openStep({
        turn: null,
        spanId: entry.spanId,
        step: entry.choice.offer_step,
        options: entry.choice.offer_options,
        optionsEn: entry.choice.offer_options_en,
        allowsFreeText: entry.choice.offer_allows_free_text,
        reconstructed: true,
      });
      answer(target, entry.choice);
    }

    // The turn's LAST point is the step it put to the user, mirroring the rule
    // a chat UI uses to decide which chip row is live; earlier ones are
    // narration the user cannot answer.
    if (entry.points.length) {
      const point = entry.points[entry.points.length - 1].attributes;
      openStep({
        turn: entry.turn,
        spanId: entry.spanId,
        step: point.step,
        question: point.question,
        messageType: point.message_type,
        options: point.options,
        optionsEn: point.options_en,
        allowsFreeText: point.allows_free_text,
      });
    }
  }

  return {
    steps,
    path: steps.map(s => (s.branches.find(b => b.taken) || {}).label).filter(Boolean),
  };
});

export default harnessTracesSlice.reducer;
