// The opening framing, and the race that decides whether anything is on screen.
//
// Two things must both exist before the view can frame itself: ReactFlow's
// instance, and a container the browser has actually laid out. Neither is
// guaranteed on the first frame, and if the view gives up after one try it
// keeps ReactFlow's default transform — which puts the tree off the top-left
// corner and shows the reader an empty canvas.
//
// ReactFlow is stubbed here so the test is about this component's logic, not
// about jsdom's ability to lay out a graph library.
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { act, render } from '@testing-library/react';

import reducer from './harnessTracesSlice';
import spans from './triagerTrace.fixture.json';

const mockFlow = { setViewport: jest.fn(), fitView: jest.fn() };
let mockPanelWidth = 0;

jest.mock('reactflow', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: ({ children, onInit }) => {
      React.useEffect(() => { if (onInit) onInit(mockFlow); }, [onInit]);
      return <div>{children}</div>;
    },
    Background: () => null,
    Controls: () => null,
    MarkerType: { ArrowClosed: 'arrowclosed' },
    Position: { Top: 'top', Bottom: 'bottom' },
  };
});

// eslint-disable-next-line import/first
import DecisionTree from './views/DecisionTree';

const VIEW_PAD = 16;
const CONTENT_W = 586;   // widest option row in the fixture; see the layout test

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() { return mockPanelWidth; },
  });
});

beforeEach(() => {
  jest.useFakeTimers();
  mockFlow.setViewport.mockClear();
  mockFlow.fitView.mockClear();
  mockPanelWidth = 0;
});

afterEach(() => { jest.useRealTimers(); });

const renderTree = () => {
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
  return render(<Provider store={store}><DecisionTree /></Provider>);
};

const frames = (n) => { for (let i = 0; i < n; i++) act(() => { jest.advanceTimersByTime(20); }); };

describe('decision tree framing', () => {
  it('waits for a measured container instead of framing into nothing', () => {
    renderTree();
    frames(3);
    expect(mockFlow.setViewport).not.toHaveBeenCalled();

    mockPanelWidth = 800;
    frames(2);
    expect(mockFlow.setViewport).toHaveBeenCalledWith({
      x: 400,                 // centre line in the middle of the panel
      y: VIEW_PAD,            // first step on the top edge, not vertically centred
      zoom: 1,                // (800 - 32) / 586 > 1, capped at actual size
    });
  });

  it('fits the width when the panel is narrower than the tree', () => {
    mockPanelWidth = 400;
    renderTree();
    frames(2);
    const { zoom } = mockFlow.setViewport.mock.calls[0][0];
    expect(zoom).toBeCloseTo((400 - 2 * VIEW_PAD) / CONTENT_W, 6);
  });

  it('never zooms below the floor, however narrow the panel', () => {
    mockPanelWidth = 120;
    renderTree();
    frames(2);
    expect(mockFlow.setViewport.mock.calls[0][0].zoom).toBe(0.5);
  });

  it('falls back to fitView rather than leaving the canvas blank', () => {
    renderTree();
    frames(40);   // container never reports a width
    expect(mockFlow.setViewport).not.toHaveBeenCalled();
    expect(mockFlow.fitView).toHaveBeenCalled();
  });
});
