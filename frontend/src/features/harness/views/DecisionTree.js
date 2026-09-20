import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Empty, Tag, Tooltip } from 'antd';
import { FullscreenExitOutlined, FullscreenOutlined } from '@ant-design/icons';
import ReactFlow, { BaseEdge, Background, Controls, MarkerType, Position } from 'reactflow';

import { selectDecisionTree, selectSelectedSpanId, selectSpan } from '../harnessTracesSlice';

import 'reactflow/dist/style.css';

// ---------------------------------------------------------------------------
// The decision-tree view: what the conversation was asked at each step, what it
// could have answered, and which branch it actually took.
//
// Drawn top-down like an org chart — a step, then its options fanned out on the
// row beneath it, then the step the taken option led to. That orientation is
// not cosmetic: ReactFlow's handles are top/bottom, so a sideways fan makes
// every edge loop back on itself.
//
// A trace holds one walk through the tree, so the untaken options matter as
// much as the taken one — they are the counterfactual, and drawing them is the
// difference between a tree and a list. They are drawn at full contrast and
// made secondary by weight rather than by fading, because an option nobody can
// read is an option that may as well not be there.
//
// Two honesty rules the drawing has to keep:
//   - a branch matched by inference (containment, fuzzy) is dashed, so nobody
//     reads a guess as a recorded fact;
//   - a step rebuilt from the *next* turn's echo (its own point event never
//     reached the trace) is labelled as such.
// ---------------------------------------------------------------------------

const INK = { primary: '#0b0b0b', secondary: '#52514e', muted: '#898781', grid: '#e1e0d9', axis: '#c3c2b7' };
const TAKEN = '#0ca30c';      // status green — the branch the conversation walked
const OTHER = '#eb6834';      // status orange — the free-text escape branch
const PENDING = '#2a78d6';    // the question still waiting on the user

const STEP_W = 300;
const STEP_H = 104;
const BRANCH_W = 186;
const BRANCH_H = 36;
const BRANCH_GAP = 14;
const STEP_TO_BRANCHES = 52;
const BRANCHES_TO_STEP = 58;

// The opening view fits the tree's *width* and pins its top to the top of the
// canvas, rather than fitView's fit-everything-and-centre. A conversation of
// any length is far taller than it is wide, so fitting the height zooms the
// whole thing down to unreadable and leaves the first step stranded in the
// middle of the panel. Fitting the width keeps the nodes at or near their
// designed size and starts the reader where the conversation started; the rest
// is a scroll away.
const VIEW_PAD = 16;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 1;      // never magnify past the size the nodes were drawn at
const FRAME_ATTEMPTS = 30;   // ~half a second of frames before giving up on a measured container

// The view claims the whole height its panel was given rather than a fixed
// canvas: the enclosing panel is already sized to the viewport minus the page
// chrome (see PANEL / PANEL_BODY in HarnessTraceView), so a column that fills
// it gives the tree every pixel that is going spare. minHeight on the canvas is
// a floor for the case where an ancestor's height does not resolve.
const SHELL = { height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' };
const CANVAS_MIN_H = 360;

// Full screen is the same column, lifted out of the panel and over the page --
// above antd's drawer/modal layer so nothing on the trace page sits over it.
const FULLSCREEN = { ...SHELL, position: 'fixed', inset: 0, zIndex: 1050, background: '#fff', padding: 16 };

// A step the trace never recorded an answer for still led somewhere, and a
// trunk that stops dead in the middle of a conversation reads as a broken
// drawing rather than as data the trace never carried. The continuation is
// drawn down a lane beside the options, not straight down through them: the
// trunk normally leaves a step by the option that was taken, and a step with no
// taken option has nothing between it and the next step but its own untaken
// row, which a vertical line would run right through.
const LANE_GAP = 24;      // clear air between the option row and the lane
const LANE_R = 10;        // corner radius
const LANE_APPROACH = 26; // the drop back onto the centre line, above the target

function SidestepEdge({ sourceX, sourceY, targetX, targetY, data, style, markerEnd, label, labelStyle, labelBgStyle }) {
  const lane = (data && data.lane != null) ? data.lane : sourceX;
  const turn = targetY - LANE_APPROACH;
  const path = [
    `M ${sourceX},${sourceY}`,
    `L ${lane + LANE_R},${sourceY}`,
    `Q ${lane},${sourceY} ${lane},${sourceY + LANE_R}`,
    `L ${lane},${turn - LANE_R}`,
    `Q ${lane},${turn} ${lane + LANE_R},${turn}`,
    `L ${targetX - LANE_R},${turn}`,
    `Q ${targetX},${turn} ${targetX},${turn + LANE_R}`,
    `L ${targetX},${targetY}`,
  ].join(' ');
  return (
    <BaseEdge
      path={path}
      style={style}
      markerEnd={markerEnd}
      label={label}
      labelX={lane}
      labelY={(sourceY + turn) / 2}
      labelStyle={labelStyle}
      labelBgStyle={labelBgStyle}
      labelShowBg
    />
  );
}

const edgeTypes = { sidestep: SidestepEdge };

function truncate(text, chars) {
  if (!text) return '';
  return text.length <= chars ? text : `${text.slice(0, chars - 1)}…`;
}

// Exported for the geometry test.
// Org-chart layout: the trunk of steps runs down the centre line, each step's
// options centred on the row below it. The trunk stays at x=0 rather than
// tracking the taken option, so a long conversation reads as one column instead
// of drifting off to one side.
export function layout(steps) {
  const pos = {};
  let y = 0;
  let width = STEP_W;
  steps.forEach((step) => {
    pos[`step:${step.turn ?? 'x'}:${step.id}`] = { x: -STEP_W / 2, y };
    const n = step.branches.length;
    const rowW = n * BRANCH_W + (n - 1) * BRANCH_GAP;
    width = Math.max(width, rowW);
    const rowY = y + STEP_H + STEP_TO_BRANCHES;
    step.branches.forEach((branch, i) => {
      pos[`branch:${branch.key}`] = { x: -rowW / 2 + i * (BRANCH_W + BRANCH_GAP), y: rowY };
    });
    y = rowY + BRANCH_H + BRANCHES_TO_STEP;
  });
  // everything is centred on x=0, so the content spans [-width/2, +width/2]
  return { pos, width, height: Math.max(y - BRANCHES_TO_STEP, 0) };
}

function stepLabel(step) {
  return (
    <div style={{ fontSize: 12, lineHeight: 1.4, textAlign: 'left' }}>
      <div style={{ color: INK.muted, fontSize: 10 }}>
        {step.turn == null ? 'before turn 0' : `turn ${step.turn}`}
        {step.messageType === 'form' ? ' · form' : ''}
      </div>
      <div style={{ fontWeight: 600, color: INK.primary }}>{step.step}</div>
      {step.question ? (
        <Tooltip title={step.question}>
          <div style={{ color: INK.secondary }}>{truncate(step.question, 76)}</div>
        </Tooltip>
      ) : null}
      {step.pending ? <Tag color="blue" style={{ marginTop: 4 }}>awaiting answer</Tag> : null}
      {step.reconstructed ? (
        <Tooltip title="No decision point was traced for this step; it was rebuilt from the offer the next turn's choice echoed.">
          <Tag style={{ marginTop: 4 }}>rebuilt</Tag>
        </Tooltip>
      ) : null}
    </div>
  );
}

function branchLabel(branch) {
  const ink = branch.taken ? INK.primary : INK.secondary;
  const body = (
    <div style={{ fontSize: 12, lineHeight: 1.25, textAlign: 'center', width: '100%' }}>
      <div style={{ color: ink, fontWeight: branch.taken ? 600 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {branch.taken ? '✓ ' : ''}{truncate(branch.label, 26)}
      </div>
      {branch.taken && branch.preview ? (
        <div style={{ color: INK.muted, fontSize: 10, fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {truncate(branch.preview, 30)}
        </div>
      ) : null}
    </div>
  );
  const title = branch.preview || (branch.label.length > 26 ? branch.label : null);
  return title ? <Tooltip title={title}>{body}</Tooltip> : body;
}

export default function DecisionTree() {
  const dispatch = useDispatch();
  const { steps, path } = useSelector(selectDecisionTree);
  const selectedSpanId = useSelector(selectSelectedSpanId);

  const wrapper = useRef(null);
  const flow = useRef(null);
  const [fullscreen, setFullscreen] = useState(false);

  const { nodes, edges, width } = useMemo(() => {
    if (!steps.length) return { nodes: [], edges: [], width: STEP_W };
    const { pos, width } = layout(steps);
    const nodes = [];
    const edges = [];
    const stepId = (step) => `step:${step.turn ?? 'x'}:${step.id}`;

    steps.forEach((step, i) => {
      const id = stepId(step);
      const accent = step.pending ? PENDING : INK.axis;
      nodes.push({
        id,
        position: pos[id],
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        data: { label: stepLabel(step), spanId: step.spanId },
        style: {
          width: STEP_W,
          height: STEP_H,
          borderRadius: 8,
          border: `2px solid ${step.spanId === selectedSpanId ? '#1677ff' : accent}`,
          background: '#fff',
          padding: 10,
          overflow: 'hidden',
        },
      });

      step.branches.forEach((branch) => {
        const bid = `branch:${branch.key}`;
        const color = branch.taken ? (branch.other ? OTHER : TAKEN) : INK.axis;
        nodes.push({
          id: bid,
          position: pos[bid],
          sourcePosition: Position.Bottom,
          targetPosition: Position.Top,
          data: { label: branchLabel(branch), spanId: step.spanId },
          style: {
            width: BRANCH_W,
            height: BRANCH_H,
            borderRadius: 18,
            // an untaken option keeps full contrast and is made secondary by
            // weight — a 1px solid rule against the taken option's 2px tint
            border: `${branch.taken ? 2 : 1}px ${branch.other ? 'dashed' : 'solid'} ${color}`,
            background: branch.taken ? (branch.other ? '#fdf1ec' : '#eef8ee') : '#fff',
            padding: '6px 10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          },
        });
        edges.push({
          id: `${id}->${bid}`,
          type: 'smoothstep',
          source: id,
          target: bid,
          style: {
            stroke: branch.taken ? color : INK.axis,
            strokeWidth: branch.taken ? 2 : 1,
            // an inferred match is drawn dashed, so a guess never reads as fact
            strokeDasharray: branch.taken ? (step.inferred ? '5 3' : undefined) : '4 4',
          },
          label: branch.taken && step.inferred ? 'inferred' : undefined,
          labelStyle: { fill: INK.muted, fontSize: 10 },
          labelBgStyle: { fill: '#fff' },
        });
      });

      // the taken option is what leads on to the next step
      const taken = step.branches.find((b) => b.taken);
      const next = steps[i + 1];
      if (taken && next) {
        edges.push({
          id: `branch:${taken.key}->${stepId(next)}`,
          type: 'smoothstep',
          source: `branch:${taken.key}`,
          target: stepId(next),
          markerEnd: { type: MarkerType.ArrowClosed, color: taken.other ? OTHER : TAKEN },
          style: { stroke: taken.other ? OTHER : TAKEN, strokeWidth: 2 },
        });
      } else if (!taken && next) {
        // No choice event ever resolved this step, so there is no taken option
        // to carry the trunk. The two steps are joined anyway — faintly, down
        // the lane, and with the gap named — because an unexplained break in
        // the trunk reads as a bug in the drawing.
        const n = step.branches.length;
        const rowW = n ? n * BRANCH_W + (n - 1) * BRANCH_GAP : STEP_W;
        edges.push({
          id: `${id}~>${stepId(next)}`,
          type: 'sidestep',
          source: id,
          target: stepId(next),
          data: { lane: -rowW / 2 - LANE_GAP },
          markerEnd: { type: MarkerType.ArrowClosed, color: INK.axis },
          style: { stroke: INK.axis, strokeWidth: 1, strokeDasharray: '2 4' },
          label: 'no choice traced',
          labelStyle: { fill: INK.muted, fontSize: 10 },
          labelBgStyle: { fill: '#fff' },
        });
      }
    });

    return { nodes, edges, width };
  }, [steps, selectedSpanId]);

  const onInit = useCallback((rf) => { flow.current = rf; }, []);

  // Read through a ref so framing does not re-run every time the tree grows a
  // step and yank the view out from under the reader.
  const widthRef = useRef(width);
  widthRef.current = width;

  // Frame on mount, and again whenever entering or leaving full screen.
  //
  // Both the ReactFlow instance and a measured container are needed, and
  // neither is guaranteed on the first frame: onInit can land before or after
  // this effect, and a flex-sized container reports clientWidth 0 until the
  // browser has laid it out. Doing the work in a retrying frame loop removes
  // the ordering question entirely -- whichever arrives last, the next frame
  // picks it up. Without this the view silently keeps ReactFlow's default
  // transform and the tree sits off the top-left corner, out of sight.
  useEffect(() => {
    let raf;
    let tries = 0;
    const attempt = () => {
      const rf = flow.current;
      const panel = wrapper.current ? wrapper.current.clientWidth : 0;
      if (rf && panel) {
        // the transform maps a graph point to the screen as
        // `point * zoom + offset`, so an offset of (half the panel, the top
        // pad) lands the centre line in the middle and step one on the top edge
        const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, (panel - 2 * VIEW_PAD) / widthRef.current));
        rf.setViewport({ x: panel / 2, y: VIEW_PAD, zoom });
        return;
      }
      if (tries++ < FRAME_ATTEMPTS) raf = requestAnimationFrame(attempt);
      else if (rf) rf.fitView();       // last resort: something on screen beats nothing
    };
    raf = requestAnimationFrame(attempt);
    return () => cancelAnimationFrame(raf);
  }, [fullscreen]);

  // Escape is the way out of anything that covers the page.
  useEffect(() => {
    if (!fullscreen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setFullscreen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  if (!steps.length) {
    return (
      <Empty description={
        <span>
          No decision events in this trace.<br />
          <span style={{ color: INK.muted, fontSize: 12 }}>
            Emit them from the SDK: <code>ps.decision_event(ps.DecisionEventName.POINT, step=..., options=[...])</code> when
            you put a step to the user, and <code>ps.DecisionEventName.CHOICE</code> with the branch their reply took.
          </span>
        </span>
      } />
    );
  }

  return (
    // Full screen is a fixed overlay rather than a modal: the tree is one deep
    // column, and what it needs is the whole page's height, not a dialog that
    // takes a slice of it. The path line comes along, being the one-line
    // summary of what the tree below it shows.
    <div style={fullscreen ? FULLSCREEN : SHELL}>
      <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, minHeight: 24 }}>
        {path.length ? (
          <div style={{ fontSize: 12, color: INK.secondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <span style={{ color: INK.muted }}>path: </span>
            {path.join(' → ')}
          </div>
        ) : null}
        <Tooltip title={fullscreen ? 'Exit full screen (Esc)' : 'Full screen'}>
          <Button
            size="small"
            type="text"
            aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}
            icon={fullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
            onClick={() => setFullscreen(v => !v)}
            style={{ marginLeft: 'auto', flex: '0 0 auto' }}
          />
        </Tooltip>
      </div>
      <div
        ref={wrapper}
        style={{
          flex: '1 1 auto',
          minHeight: CANVAS_MIN_H,
          border: `1px solid ${INK.grid}`,
          borderRadius: 8,
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          edgeTypes={edgeTypes}
          onInit={onInit}
          minZoom={0.2}
          // The wheel pans instead of zooming, which the other ReactFlow views
          // do not do. A decision tree is a tall column read top to bottom, so
          // scrolling is the reading gesture; leaving the wheel on zoom means
          // every attempt to read further down shrinks the thing being read.
          // Ctrl/⌘+wheel and a trackpad pinch still zoom (zoomOnPinch), and the
          // Controls keep their explicit zoom buttons.
          panOnScroll
          zoomOnScroll={false}
          nodesDraggable={false}
          nodesConnectable={false}
          onNodeClick={(_, node) => { if (node.data.spanId) dispatch(selectSpan(node.data.spanId)); }}
        >
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}
