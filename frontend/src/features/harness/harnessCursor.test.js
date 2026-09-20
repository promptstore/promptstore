// The incremental cursor. `lastSeq` is what the polling fallback sends as
// `?since=` and what a live tail resumes from, so reading it off the wrong
// field does not degrade the view — it stops it: every span written by a
// process whose own counter restarted lands below the cursor and is never
// fetched, and a running trace simply appears to stop.
import reducer, { setTraceSpans, upsertSpans, startTraceLoad } from './harnessTracesSlice';

const span = (id, fields) => ({
  span_id: id, span_kind: 'loop.iteration', start_time: '2026-01-01T00:00:00Z', ...fields,
});

const load = (spans) => {
  let state = reducer(undefined, startTraceLoad({ traceId: 't' }));
  return reducer(state, setTraceSpans({ spans, summary: null }));
};

describe('harness trace cursor', () => {
  it('tracks the server cursor, not the emitter counter', () => {
    const state = load([span('a', { seq: 1, ingest_seq: 9001 }), span('b', { seq: 2, ingest_seq: 9002 })]);
    expect(state.current.lastSeq).toBe(9002);
  });

  it("does not go backwards when a restarted emitter's counter does", () => {
    // the same trace, continued by a process that began counting again at 1
    const loaded = load([span('a', { seq: 40, ingest_seq: 9001 })]);
    const next = reducer(loaded, upsertSpans({ spans: [span('b', { seq: 1, ingest_seq: 9002 })] }));
    expect(next.current.lastSeq).toBe(9002);
    expect(next.current.spans.b).toBeTruthy();
  });

  it('advances on a patch to a span already seen, so an end event is delivered', () => {
    const loaded = load([span('a', { seq: 1, ingest_seq: 9001 })]);
    const next = reducer(loaded, upsertSpans({
      spans: [span('a', { seq: 1, ingest_seq: 9007, end_time: '2026-01-01T00:00:05Z' })],
    }));
    expect(next.current.lastSeq).toBe(9007);
    expect(next.current.spans.a.end_time).toBe('2026-01-01T00:00:05Z');
  });

  it('falls back to the emitter counter for a span with no server cursor', () => {
    const state = load([span('a', { seq: 3 })]);
    expect(state.current.lastSeq).toBe(3);
  });
});
