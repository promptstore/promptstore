// The full-screen toggle. Worth a render test rather than eyeballing: the
// overlay is a fixed-position div, so a regression here covers the page with
// something the user cannot dismiss, and Escape is the only way out.
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { fireEvent, render, screen } from '@testing-library/react';

import reducer from './harnessTracesSlice';
import DecisionTree from './views/DecisionTree';
import spans from './triagerTrace.fixture.json';

// ReactFlow measures its container; jsdom has neither API.
global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
global.DOMMatrixReadOnly = class { constructor() { this.m22 = 1; } };
window.requestAnimationFrame = (cb) => setTimeout(cb, 0);
window.cancelAnimationFrame = (id) => clearTimeout(id);

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

const overlay = (container) => container.querySelector('div[style*="fixed"]');

describe('decision tree full screen', () => {
  it('starts inline and expands on demand', () => {
    const { container } = renderTree();
    expect(overlay(container)).toBeNull();

    fireEvent.click(screen.getByLabelText('Full screen'));
    expect(overlay(container)).not.toBeNull();
  });

  it('collapses again from the button', () => {
    const { container } = renderTree();
    fireEvent.click(screen.getByLabelText('Full screen'));
    fireEvent.click(screen.getByLabelText('Exit full screen'));
    expect(overlay(container)).toBeNull();
  });

  it('collapses on Escape, so the overlay is never a trap', () => {
    const { container } = renderTree();
    fireEvent.click(screen.getByLabelText('Full screen'));
    // on body, not document: ReactFlow's own document-level keydown handler
    // reads target.hasAttribute, which only an Element has
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(overlay(container)).toBeNull();
  });

  it('keeps the path summary with the tree in both modes', () => {
    renderTree();
    const path = () => screen.getByText(/^path:/).parentElement.textContent;
    expect(path()).toContain('Continue');
    fireEvent.click(screen.getByLabelText('Full screen'));
    expect(path()).toContain('Continue');
  });
});
