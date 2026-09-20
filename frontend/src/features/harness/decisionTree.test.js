// The decision-tree selector's one subtle rule: a choice is emitted on the turn
// that ANSWERED, so turn n's choice resolves turn n-1's step. Get the pairing
// wrong and every branch is attributed to the wrong question.
import { selectDecisionTree, OTHER_BRANCH } from './harnessTracesSlice';

const turn = (index, events) => ({
  span_id: `turn-${index}`,
  parent_span_id: 'root',
  span_kind: 'loop.iteration',
  seq: index + 1,
  start_time: `2026-01-01T00:0${index}:00Z`,
  events,
});

const root = { span_id: 'root', span_kind: 'harness.run', seq: 0, start_time: '2026-01-01T00:00:00Z' };

const point = (attributes) => ({ name: 'ps.decision.point', time: 't', attributes });
const choice = (attributes) => ({ name: 'ps.decision.choice', time: 't', attributes });

const run = (spans) => selectDecisionTree.resultFunc(
  Object.fromEntries(spans.map(s => [s.span_id, s]))
);

const OFFER = { step: 'DiagnosingNode', question: 'Dripping or running?', options: ['Dripping', 'Running'], allows_free_text: true };

describe('selectDecisionTree', () => {
  it('is empty for a trace that emits no decision events', () => {
    expect(run([root, turn(0, [{ name: 'ps.context.assemble', attributes: {} }])])).toEqual({ steps: [], path: [] });
  });

  it("attributes a choice to the previous turn's step", () => {
    const { steps, path } = run([
      root,
      turn(0, [point(OFFER)]),
      turn(1, [choice({ offer_step: 'DiagnosingNode', branch: 'Dripping', branch_index: 0, match: 'exact' }), point({ step: 'AwaitingSlotsNode' })]),
    ]);

    expect(steps).toHaveLength(2);
    expect(steps[0].step).toBe('DiagnosingNode');
    expect(steps[0].answered).toBe(true);
    expect(steps[0].branches.find(b => b.taken).label).toBe('Dripping');
    expect(steps[1].pending).toBe(true);
    expect(path).toEqual(['Dripping']);
  });

  it('offers an Other branch only where free text is accepted', () => {
    const open = run([root, turn(0, [point(OFFER)])]).steps[0];
    expect(open.branches.map(b => b.label)).toEqual(['Dripping', 'Running', 'Other']);

    const locked = run([root, turn(0, [point({ ...OFFER, allows_free_text: false })])]).steps[0];
    expect(locked.branches.map(b => b.label)).toEqual(['Dripping', 'Running']);
  });

  it('carries the preview on a taken Other branch', () => {
    const { steps, path } = run([
      root,
      turn(0, [point(OFFER)]),
      turn(1, [choice({ branch: OTHER_BRANCH, match: 'none', reply_preview: 'the ceiling is wet' })]),
    ]);
    const other = steps[0].branches.find(b => b.other);
    expect(other.taken).toBe(true);
    expect(other.preview).toBe('the ceiling is wet');
    expect(path).toEqual(['Other']);
  });

  it('rebuilds a step whose point event never reached the trace', () => {
    // the opening message is written outside any turn, so turn 0 only ever
    // carries the choice that answered it
    const { steps } = run([
      root,
      turn(0, [choice({
        offer_step: 'EmergencyTriageNode',
        offer_options: ['Emergency', 'Continue'],
        offer_allows_free_text: false,
        branch: 'Continue',
        branch_index: 1,
        match: 'exact',
      })]),
    ]);
    expect(steps).toHaveLength(1);
    expect(steps[0].step).toBe('EmergencyTriageNode');
    expect(steps[0].reconstructed).toBe(true);
    expect(steps[0].branches.find(b => b.taken).label).toBe('Continue');
  });

  it('marks a loosely-matched branch as inferred', () => {
    const certain = run([root, turn(0, [point(OFFER)]), turn(1, [choice({ branch: 'Dripping', branch_index: 0, match: 'exact' })])]);
    expect(certain.steps[0].inferred).toBe(false);

    const loose = run([root, turn(0, [point(OFFER)]), turn(1, [choice({ branch: 'Dripping', branch_index: 0, match: 'fuzzy' })])]);
    expect(loose.steps[0].inferred).toBe(true);
  });

  it("uses the turn's last point, the way a chat UI picks the live chip row", () => {
    const { steps } = run([
      root,
      turn(0, [point({ step: 'IssueDetectionNode', question: 'You reported two issues' }), point(OFFER)]),
    ]);
    expect(steps).toHaveLength(1);
    expect(steps[0].question).toBe('Dripping or running?');
  });
});
