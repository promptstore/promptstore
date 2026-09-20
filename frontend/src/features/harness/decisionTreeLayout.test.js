// Geometry of the org-chart layout. The failure this guards against is visual
// and silent — overlapping nodes, or a trunk that drifts off the centre line —
// neither of which any other test would notice.
import { layout } from './views/DecisionTree';
import { selectDecisionTree } from './harnessTracesSlice';
import spans from './triagerTrace.fixture.json';

const STEP_W = 300;
const BRANCH_W = 186;
const BRANCH_GAP = 14;

const steps = selectDecisionTree.resultFunc(
  Object.fromEntries(spans.map(s => [s.span_id, s]))
).steps;

const { pos, width, height } = layout(steps);
const stepKey = (s) => `step:${s.turn ?? 'x'}:${s.id}`;

describe('decision-tree layout', () => {
  it('reports the content box the opening viewport is fitted to', () => {
    // everything is centred on x=0, so width is the widest option row
    const widest = Math.max(...steps.map(s =>
      s.branches.length * BRANCH_W + (s.branches.length - 1) * BRANCH_GAP));
    expect(width).toBe(Math.max(widest, STEP_W));
    expect(height).toBeGreaterThan(width);   // why fitting the width, not the height
  });

  it('places every step and every branch', () => {
    const expected = steps.length + steps.reduce((a, s) => a + s.branches.length, 0);
    expect(Object.keys(pos)).toHaveLength(expected);
  });

  it('runs the trunk straight down the centre line', () => {
    const xs = new Set(steps.map(s => pos[stepKey(s)].x));
    expect([...xs]).toEqual([-STEP_W / 2]);
  });

  it('centres each row of options on the step that offered them', () => {
    steps.forEach((step) => {
      const centres = step.branches.map(b => pos[`branch:${b.key}`].x + BRANCH_W / 2);
      const mid = (Math.min(...centres) + Math.max(...centres)) / 2;
      expect(mid).toBeCloseTo(0, 6);
    });
  });

  it('never lets a step overlap its own options or the row above', () => {
    let lowest = -Infinity;
    steps.forEach((step) => {
      const stepY = pos[stepKey(step)].y;
      expect(stepY).toBeGreaterThan(lowest);
      step.branches.forEach((b) => {
        const branch = pos[`branch:${b.key}`];
        expect(branch.y).toBeGreaterThan(stepY);
        lowest = Math.max(lowest, branch.y);
      });
    });
  });

  it('spaces options within a row without overlap', () => {
    steps.forEach((step) => {
      const xs = step.branches.map(b => pos[`branch:${b.key}`].x).sort((a, b) => a - b);
      xs.slice(1).forEach((x, i) => expect(x - xs[i]).toBeGreaterThanOrEqual(BRANCH_W));
    });
  });
});
