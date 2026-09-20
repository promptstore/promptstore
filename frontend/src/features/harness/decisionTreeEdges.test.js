// The trunk: every step has to lead somewhere.
//
// A step is normally joined to the next one through the option the conversation
// took. Where no choice event ever resolved a step the taken option does not
// exist, and without a fallback the trunk simply stops — two steps stacked with
// nothing between them, which reads as a broken drawing rather than as data the
// trace never carried.
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { render } from '@testing-library/react';

import reducer from './harnessTracesSlice';

let lastProps = null;

// The nodes and edges the view hands ReactFlow are the subject here, so the
// library is stubbed down to a prop recorder. Framing is somebody else's test.
jest.mock('reactflow', () => ({
  __esModule: true,
  default: (props) => { lastProps = props; return null; },
  BaseEdge: () => null,
  Background: () => null,
  Controls: () => null,
  MarkerType: { ArrowClosed: 'arrowclosed' },
  Position: { Top: 'top', Bottom: 'bottom' },
}));

// eslint-disable-next-line import/first
import DecisionTree from './views/DecisionTree';

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

const OFFER = { step: 'DiagnosingNode', question: 'Dripping or running?', options: ['Dripping', 'Running'], allows_free_text: true };

const renderTree = (spans) => {
  const store = configureStore({
    reducer: { harnessTraces: reducer },
    preloadedState: {
      harnessTraces: {
        count: 0, loading: false, loaded: true, list: [],
        current: {
          traceId: 't', spans: Object.fromEntries(spans.map(s => [s.span_id, s])),
          selectedSpanId: null, mode: 'completed', lastSeq: -1, summary: null,
          loading: false, tailing: false, payloads: {},
        },
      },
    },
  });
  render(<Provider store={store}><DecisionTree /></Provider>);
  return lastProps;
};

const stepIds = (nodes) => nodes.filter(n => n.id.startsWith('step:')).map(n => n.id);

describe('decision-tree edges', () => {
  it('runs the trunk through the option the conversation took', () => {
    const { nodes, edges } = renderTree([
      root,
      turn(0, [point(OFFER)]),
      turn(1, [choice({ branch: 'Dripping', branch_index: 0, match: 'exact' }), point({ step: 'AwaitingSlotsNode' })]),
    ]);
    const [first, second] = stepIds(nodes);
    const taken = nodes.find(n => n.id.startsWith('branch:') && n.id.endsWith(':0'));

    expect(edges.find(e => e.source === first && e.target === taken.id)).toBeTruthy();
    expect(edges.find(e => e.source === taken.id && e.target === second)).toBeTruthy();
    // nothing is joined step-to-step while an option carries the trunk
    expect(edges.find(e => e.source === first && e.target === second)).toBeFalsy();
  });

  it('joins a step the trace never recorded an answer for to the one that followed', () => {
    const { nodes, edges } = renderTree([
      root,
      turn(0, [point(OFFER)]),
      turn(1, [point({ step: 'AwaitingSlotsNode' })]),   // no choice ever resolved turn 0
    ]);
    const [first, second] = stepIds(nodes);
    const join = edges.find(e => e.source === first && e.target === second);

    expect(join).toBeTruthy();
    expect(join.label).toBe('no choice traced');
    // faint and dotted: the drawing must not read the join as a recorded branch
    expect(join.style.strokeDasharray).toBeTruthy();
    expect(join.style.strokeWidth).toBe(1);

    // and routed down a lane clear of the option row it has to get past --
    // straight down the centre line would cross the options themselves
    const options = nodes.filter(n => n.id.startsWith('branch:s0:'));
    const leftmost = Math.min(...options.map(n => n.position.x));
    expect(join.type).toBe('sidestep');
    expect(join.data.lane).toBeLessThan(leftmost);
  });

  it('leaves the last step open rather than inventing somewhere for it to go', () => {
    const { nodes, edges } = renderTree([root, turn(0, [point(OFFER)])]);
    const [only] = stepIds(nodes);
    expect(edges.filter(e => e.target === only)).toHaveLength(0);
    expect(edges.every(e => e.source !== only || e.target.startsWith('branch:'))).toBe(true);
  });
});
