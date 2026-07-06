import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Empty, Segmented, Tooltip } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';

import { selectContextTimeline, selectSelectedSpanId, selectSpan } from '../harnessTracesSlice';

// ---------------------------------------------------------------------------
// The context-lifecycle view: what is in the model's context window, where it
// came from, and how each step (assemble / retrieve / compact / evict)
// transformed it. Three coordinated pieces, all driven by one selected event:
//   1. a stacked step-area "token budget over steps" chart (click to navigate)
//   2. a breadcrumb + stepper locating the event in agent › turn › step terms
//   3. a readable detail: composition bar, source table, and change card
// Colors follow the dataviz method: categorical slots assigned to sources in
// fixed order (validated palette), status colors reserved for change-states.
// ---------------------------------------------------------------------------

// categorical slots (validated: worst adjacent CVD dE 24.2 on light surface)
const SOURCE_COLORS = {
  system: '#2a78d6',        // blue
  instructions: '#1baf7a',  // aqua
  history: '#eda100',       // yellow
  retrieved: '#008300',     // green
  tool_result: '#4a3aa7',   // violet
  scratchpad: '#e34948',    // red
  user: '#e87ba4',          // magenta
  assistant: '#eb6834',     // orange
  unattributed: '#898781',  // muted — carry-forward/unknown
};
const SOURCE_ORDER = ['system', 'instructions', 'history', 'retrieved', 'tool_result', 'scratchpad', 'user', 'assistant', 'unattributed'];
// label ink per segment: dark ink on the light hues (aqua/yellow/magenta), white on the rest
const LIGHT_SEGMENTS = new Set(['instructions', 'history', 'user']);
const segmentInk = (source) => (LIGHT_SEGMENTS.has(source) ? '#0b0b0b' : '#ffffff');

// chart chrome (ink tokens — text never wears series color)
const INK = { primary: '#0b0b0b', secondary: '#52514e', muted: '#898781', grid: '#e1e0d9', axis: '#c3c2b7', surface: '#ffffff' };

// change-state visuals: status colors, always paired with an icon + word
const EVENT_META = {
  assemble: { icon: '⊕', label: 'Assemble', color: INK.secondary, symbol: 'circle' },
  retrieve: { icon: '＋', label: 'Retrieve', color: '#0ca30c', symbol: 'triangle' },
  compact: { icon: '✂', label: 'Compact', color: '#fab219', symbol: 'diamond' },
  evict: { icon: '−', label: 'Evict', color: '#ec835a', symbol: 'triangle-down' },
};

// Recommended maximum context utilization — usage at or below this is the
// "optimum" operating range; above it, quality tends to degrade well before
// the hard window limit. Absolute token count, not a fraction of the window.
const OPTIMUM_MAX_TOKENS = 80000;
const OPTIMUM_BAND_COLOR = 'rgba(12,163,12,0.07)';

const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString());

function sourceChip(source) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 10, height: 10, borderRadius: 2, background: SOURCE_COLORS[source] || SOURCE_COLORS.unattributed, display: 'inline-block' }} />
      <span style={{ color: INK.primary }}>{source}</span>
    </span>
  );
}

// ---- 1. the budget-over-steps chart ----------------------------------------
function BudgetChart({ timeline, selectedIndex, onSelect }) {
  const options = useMemo(() => {
    // sources outside the six standard names fold into the gray 'unattributed'
    // band (never dropped, never assigned a new hue — fixed categorical order)
    const KNOWN = new Set(SOURCE_ORDER.filter(s => s !== 'unattributed'));
    const tokensFor = (e, src) => e.composition.reduce((a, c) => {
      const bucket = KNOWN.has(c.source) ? c.source : 'unattributed';
      return a + (bucket === src ? (c.tokens || 0) : 0);
    }, 0);
    const sources = SOURCE_ORDER.filter(src => timeline.some(e => tokensFor(e, src) > 0));
    const categories = timeline.map(e => (e.turn != null ? `T${e.turn}` : '·'));
    const limit = Math.max(...timeline.map(e => e.limit || 0), 0) || null;

    const series = sources.map(src => ({
      type: 'area',
      name: src,
      color: SOURCE_COLORS[src],
      // 2px surface gap between stacked bands
      lineWidth: 2,
      lineColor: INK.surface,
      marker: { enabled: false },
      data: timeline.map(e => tokensFor(e, src)),
    }));

    // clickable event markers riding the stack top — shape + color + tooltip word
    series.push({
      type: 'scatter',
      name: 'Steps',
      showInLegend: false,
      zIndex: 5,
      data: timeline.map(e => ({
        x: e.index,
        y: e.total || 0,
        marker: {
          symbol: EVENT_META[e.kind].symbol,
          fillColor: EVENT_META[e.kind].color,
          lineColor: INK.primary,
          lineWidth: 1,
          radius: e.index === selectedIndex ? 7 : 5,
        },
        custom: { kind: e.kind },
      })),
    });

    return {
      chart: { height: 240, backgroundColor: 'transparent', spacing: [8, 4, 4, 4] },
      title: { text: null },
      credits: { enabled: false },
      legend: { itemStyle: { color: INK.secondary, fontWeight: 'normal', fontSize: '11px' } },
      xAxis: {
        categories,
        crosshair: { color: INK.grid, width: 1 },
        lineColor: INK.axis,
        tickLength: 0,
        labels: { style: { color: INK.muted, fontSize: '10px' } },
        plotBands: selectedIndex != null ? [{
          from: selectedIndex - 0.5, to: selectedIndex + 0.5, color: 'rgba(42,120,214,0.08)',
        }] : [],
      },
      yAxis: {
        title: { text: 'tokens', style: { color: INK.muted } },
        gridLineColor: INK.grid,
        labels: { style: { color: INK.muted, fontSize: '10px' } },
        max: limit ? Math.round(limit * 1.05) : undefined,
        endOnTick: false,   // keep the limit line near the top, no 300k overshoot
        // optimum range: 0 → 80k tokens (clamped to the window), shaded green
        plotBands: [{
          from: 0,
          to: limit ? Math.min(OPTIMUM_MAX_TOKENS, limit) : OPTIMUM_MAX_TOKENS,
          color: OPTIMUM_BAND_COLOR,
          zIndex: 0,
          label: {
            text: `optimum ≤ ${fmt(OPTIMUM_MAX_TOKENS)}`,
            align: 'left', verticalAlign: 'top', x: 8, y: 12,
            style: { color: INK.muted, fontSize: '10px' },
          },
        }],
        plotLines: limit ? [{
          value: limit, color: INK.primary, width: 1, dashStyle: 'Dash', zIndex: 4,
          label: { text: `window limit ${fmt(limit)}`, align: 'right', style: { color: INK.secondary, fontSize: '10px' } },
        }] : [],
      },
      tooltip: {
        shared: true,
        useHTML: true,
        formatter: function () {
          const e = timeline[this.points ? this.points[0].point.x : this.x];
          if (!e) return false;
          const rows = e.composition.map(c =>
            `<div><span style="color:${SOURCE_COLORS[c.source] || SOURCE_COLORS.unattributed}">●</span> ${c.source}: <b>${fmt(c.tokens)}</b></div>`).join('');
          const util = e.limit ? ` (${Math.round((e.total / e.limit) * 100)}% of window)` : '';
          const meta = EVENT_META[e.kind];
          return `<div style="font-size:11px"><b>${meta.icon} ${meta.label}</b> · ${e.agentLabel || ''} › ${e.turnLabel || ''}${e.carried ? ' · composition carried' : ''}<br/>${rows}<div>total: <b>${fmt(e.total)}</b>${util}</div></div>`;
        },
      },
      plotOptions: {
        // step 'center': each category band shows its own value, so a compaction's
        // drop is visible in the compaction's own column
        area: { stacking: 'normal', step: 'center', cursor: 'pointer' },
        series: {
          cursor: 'pointer',
          point: { events: { click: function () { onSelect(this.x); } } },
          states: { inactive: { opacity: 1 } },
        },
      },
      series,
    };
  }, [timeline, selectedIndex, onSelect]);

  return <HighchartsReact highcharts={Highcharts} options={options} />;
}

// ---- 2. breadcrumb + stepper ------------------------------------------------
function Breadcrumb({ event, index, count, onStep }) {
  const meta = EVENT_META[event.kind];
  const util = event.limit && event.total != null ? Math.round((event.total / event.limit) * 100) : null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
      <Button size="small" icon={<LeftOutlined />} disabled={index === 0} onClick={() => onStep(index - 1)} />
      <Button size="small" icon={<RightOutlined />} disabled={index >= count - 1} onClick={() => onStep(index + 1)} />
      <span style={{ color: INK.muted, fontSize: 12 }}>step {index + 1} of {count}</span>
      <span style={{ color: INK.secondary, fontSize: 13 }}>
        <b style={{ color: INK.primary }}>{event.agentLabel || 'run'}</b>
        {event.turnLabel ? <> › {event.turnLabel}</> : null}
        {' › '}
        <span style={{ border: `1px solid ${meta.color}`, borderRadius: 4, padding: '0 6px' }}>
          {meta.icon} {meta.label}
        </span>
      </span>
      <span style={{ marginLeft: 'auto', color: INK.secondary, fontSize: 12 }}>
        {fmt(event.total)} / {fmt(event.limit)} tok{util != null ? ` · ${util}% of window` : ''}
      </span>
    </div>
  );
}

// ---- 3a. composition bar (100% of window, incl. free budget) ---------------
function CompositionBar({ event }) {
  const limit = event.limit || event.total || 1;
  const free = Math.max(limit - (event.total || 0), 0);
  const segs = [...event.composition.filter(c => c.tokens > 0)];
  return (
    <div>
      <div style={{ display: 'flex', gap: 2, height: 26, borderRadius: 4, overflow: 'hidden' }}>
        {segs.map((c) => {
          const pct = (c.tokens / limit) * 100;
          return (
            <Tooltip key={c.source} title={`${c.source}: ${fmt(c.tokens)} tokens (${Math.round(pct)}% of window)`}>
              <div style={{ width: `${pct}%`, minWidth: pct > 0 ? 3 : 0, background: SOURCE_COLORS[c.source] || SOURCE_COLORS.unattributed, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {pct > 9 ? <span style={{ color: segmentInk(c.source), fontSize: 10, whiteSpace: 'nowrap' }}>{c.source} {fmt(c.tokens)}</span> : null}
              </div>
            </Tooltip>
          );
        })}
        {free > 0 ? (
          <Tooltip title={`free budget: ${fmt(free)} tokens`}>
            <div style={{ width: `${(free / limit) * 100}%`, background: 'transparent', border: `1px dashed ${INK.axis}`, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: INK.muted, fontSize: 10 }}>free {fmt(free)}</span>
            </div>
          </Tooltip>
        ) : null}
      </div>
    </div>
  );
}

// ---- 3b. source table (the contrast-relief table view) ----------------------
function SourceTable({ event }) {
  const total = event.total || 1;
  return (
    <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
      <tbody>
        {event.composition.map(c => (
          <tr key={c.source} style={{ borderTop: `1px solid ${INK.grid}` }}>
            <td style={{ padding: '5px 4px', width: 130 }}>{sourceChip(c.source)}</td>
            <td style={{ padding: '5px 4px', textAlign: 'right', width: 90, color: INK.primary, fontVariantNumeric: 'tabular-nums' }}>{fmt(c.tokens)}</td>
            <td style={{ padding: '5px 4px', textAlign: 'right', width: 50, color: INK.muted, fontVariantNumeric: 'tabular-nums' }}>{Math.round((c.tokens / total) * 100)}%</td>
            <td style={{ padding: '5px 4px', color: INK.secondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 0 }}>
              {c.label || c.preview || ''}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---- 3c. what this step changed ---------------------------------------------
function ChangeCard({ event }) {
  const p = event.payload;
  const meta = EVENT_META[event.kind];
  const before = p.window_tokens_before;
  const after = p.window_tokens_after;
  const delta = before != null && after != null ? after - before : null;
  const lines = [];
  if (p.method) lines.push(['method', p.method]);
  if (p.policy) lines.push(['policy', p.policy]);
  if (p.reason) lines.push(['reason', p.reason]);
  if (p.tokens_reclaimed != null) lines.push(['reclaimed', `${fmt(p.tokens_reclaimed)} tok`]);
  if (p.tokens_evicted != null) lines.push(['evicted', `${fmt(p.tokens_evicted)} tok`]);
  if (p.items_evicted != null) lines.push(['items evicted', fmt(p.items_evicted)]);
  if (p.summarized_from?.length) lines.push(['summarized', `${p.summarized_from.length} items → ${p.summarized_into || 'summary'}`]);
  if (p.added_ids?.length) lines.push(['added', `${p.added_ids.length} items`]);
  if (p.dropped_ids?.length) lines.push(['dropped', `${p.dropped_ids.length} items`]);

  return (
    <div style={{ border: `1px solid ${INK.grid}`, borderLeft: `3px solid ${meta.color}`, borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
      <div style={{ color: INK.primary, fontWeight: 600, marginBottom: 4 }}>
        {meta.icon} {meta.label}
        {delta != null ? (
          <span style={{ marginLeft: 8, color: delta > 0 ? '#006300' : '#d03b3b', fontWeight: 600 }}>
            {fmt(before)} → {fmt(after)} tok ({delta > 0 ? '+' : ''}{fmt(delta)})
          </span>
        ) : null}
        {event.carried ? <span style={{ marginLeft: 8, color: INK.muted, fontWeight: 400 }}>(composition carried forward)</span> : null}
      </div>
      {lines.map(([k, v]) => (
        <div key={k} style={{ color: INK.secondary }}><span style={{ color: INK.muted }}>{k}:</span> {v}</div>
      ))}
      {!lines.length ? <div style={{ color: INK.muted }}>no additional detail reported</div> : null}
    </div>
  );
}

// ---- container ---------------------------------------------------------------
export default function ContextLifecycle() {
  const dispatch = useDispatch();
  const timeline = useSelector(selectContextTimeline);
  const selectedSpanId = useSelector(selectSelectedSpanId);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [detailTab, setDetailTab] = useState('composition');

  // clamp when the timeline grows/shrinks (live)
  useEffect(() => {
    if (selectedIndex > timeline.length - 1) setSelectedIndex(Math.max(timeline.length - 1, 0));
  }, [timeline.length, selectedIndex]);

  // when a span with context events is selected elsewhere (tree/waterfall),
  // jump the scrubber to that span's first event
  useEffect(() => {
    if (!selectedSpanId) return;
    const idx = timeline.findIndex(e => e.spanId === selectedSpanId);
    if (idx >= 0) setSelectedIndex(idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSpanId]);

  if (!timeline.length) {
    return (
      <Empty description={
        <span>
          No context events in this trace.<br />
          <span style={{ color: INK.muted, fontSize: 12 }}>
            Emit them from the SDK: <code>ps.context_event(ps.ContextEventName.ASSEMBLE, sources=[...], window_tokens_after=..., window_limit=...)</code>
          </span>
        </span>
      } />
    );
  }

  const event = timeline[Math.min(selectedIndex, timeline.length - 1)];

  const onSelect = (idx) => {
    setSelectedIndex(idx);
    const e = timeline[idx];
    if (e) dispatch(selectSpan(e.spanId));   // sync tree/waterfall/graph
  };

  return (
    <div>
      <BudgetChart timeline={timeline} selectedIndex={selectedIndex} onSelect={onSelect} />
      <Breadcrumb event={event} index={selectedIndex} count={timeline.length} onStep={onSelect} />
      <CompositionBar event={event} />
      <div style={{ marginTop: 12 }}>
        <Segmented
          size="small"
          value={detailTab}
          onChange={setDetailTab}
          options={[{ label: 'Composition', value: 'composition' }, { label: 'What changed', value: 'change' }]}
          style={{ marginBottom: 8 }}
        />
        {detailTab === 'composition' ? <SourceTable event={event} /> : <ChangeCard event={event} />}
      </div>
    </div>
  );
}
