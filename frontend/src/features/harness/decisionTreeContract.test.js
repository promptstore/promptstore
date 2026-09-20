// A contract test across the repo boundary.
//
// The fixture is a real span batch captured off the promptstore telemetry SDK
// while driving a Tapi Triager conversation -- the welcome offer answered
// before any turn was traced, a free-text description, a chip question answered
// by typing something close but not equal, a slot form, and a final question
// still waiting on the user. It exists so a change to the selector, or to the
// event payloads an emitter sends, cannot quietly stop producing a tree.
//
// To refresh it, re-run the emitter capture and replace the JSON; the shape
// asserted below is the contract, not the exact wording.
import { selectDecisionTree } from './harnessTracesSlice';
import spans from './triagerTrace.fixture.json';

const tree = () => selectDecisionTree.resultFunc(
  Object.fromEntries(spans.map(s => [s.span_id, s]))
);

const taken = (step) => (step.branches.find(b => b.taken) || {}).label;

describe('decision tree, against a captured Triager trace', () => {
  it('walks every step the conversation reached', () => {
    const { steps, path } = tree();
    expect(steps.map(s => s.step)).toEqual([
      'EmergencyTriageNode',
      'FirstMessageNode',
      'DiagnosingNode',
      'AwaitingSlotsNode',
      'AwaitingResolutionNode',
    ]);
    expect(path).toEqual(['Continue', 'Other', 'Dripping', 'Other']);
  });

  it('rebuilds the opening offer, which was made before any turn was traced', () => {
    const [opening] = tree().steps;
    expect(opening.reconstructed).toBe(true);
    expect(opening.turn).toBeNull();
    // the composer is locked during emergency triage, so there is no Other
    expect(opening.branches.map(b => b.label)).toEqual(['Emergency', 'Continue']);
    expect(taken(opening)).toBe('Continue');
  });

  it('answers a free-text step instead of leaving it pending forever', () => {
    const step = tree().steps.find(s => s.step === 'FirstMessageNode');
    expect(step.pending).toBe(false);
    expect(step.branches.map(b => b.label)).toEqual(['Other']);
  });

  it('marks only the loosely-matched branch as inferred', () => {
    const inferred = tree().steps.filter(s => s.inferred).map(s => s.step);
    // "it's just dripping I think" reached Dripping by containment; every other
    // step was matched outright, and taking Other is a definite outcome
    expect(inferred).toEqual(['DiagnosingNode']);
  });

  it('keeps a form submission out of the Other branch preview', () => {
    const form = tree().steps.find(s => s.step === 'AwaitingSlotsNode');
    expect(taken(form)).toBe('Other');
    expect(form.branches.find(b => b.other).preview).toBeFalsy();
  });

  it('leaves the unanswered question pending', () => {
    const steps = tree().steps;
    const last = steps[steps.length - 1];
    expect(last.pending).toBe(true);
    expect(steps.filter(s => s.pending)).toHaveLength(1);
  });
});
