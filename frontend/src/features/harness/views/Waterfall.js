import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import HighchartsReact from 'highcharts-react-official';

import Highcharts, { registerFlameSeries } from '../charts/flameSeries';
import { selectSpanTree, selectSelectedSpanId, selectSpan } from '../harnessTracesSlice';

registerFlameSeries();

// Color per span kind — kept in one place so tree, waterfall, and legend agree.
export const KIND_COLORS = {
  'harness.run': '#6366f1',
  'loop.iteration': '#0ea5e9',
  'model.call': '#22c55e',
  'tool.call': '#f59e0b',
  'subagent.spawn': '#a855f7',
  'hitl.pause': '#94a3b8',
  'composition.call': '#14b8a6',
  'function.call': '#84cc16',
  'prompt.render': '#eab308',
  'context.op': '#ec4899',
  'retrieval': '#38bdf8',
  'evaluation': '#f97316',
  'guardrail': '#ef4444',
  'custom': '#94a3b8',
};

// One span = one 26px band, matching the span tree's row pitch (see
// .harness-span-tree in App.css) so row N of the tree sits on row N of the
// chart. AXIS_H is the space below the plot for the value labels and title;
// the plot itself starts flush with the top of the chart (marginTop 0).
export const ROW_H = 26;
const AXIS_H = 60;
// Highcharts collapses ordinary leading/trailing spaces in axis labels.
const NBSP = '\u00a0';

// axis labels render as HTML below, and span names come from instrumented apps
function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function countDescendants(nodes) {
  return nodes.reduce((sum, n) => sum + 1 + (n.children ? countDescendants(n.children) : 0), 0);
}

// `expanded` is the tree's expandedKeys as a Set: a node's children are plotted
// only when the tree is showing them. Pass nothing to flatten the whole tree.
// A row whose children are hidden carries the count of what it stands in for.
function flatten(nodes, depth, out, expanded) {
  for (const n of nodes) {
    const hasChildren = !!(n.children && n.children.length);
    const open = hasChildren && (!expanded || expanded.has(n.span_id));
    out.push({ span: n, depth, hidden: hasChildren && !open ? countDescendants(n.children) : 0 });
    if (open) flatten(n.children, depth + 1, out, expanded);
  }
  return out;
}

// `scale` ('linear' | 'log') is owned by the trace view, which renders the
// scale switch alongside the view switch, as is `expandedKeys` — the chart plots
// the same rows the span tree is showing, in the same order.
export default function Waterfall({ scale = 'linear', expandedKeys }) {
  const dispatch = useDispatch();
  const tree = useSelector(selectSpanTree);
  const selectedSpanId = useSelector(selectSelectedSpanId);
  const [tick, setTick] = useState(0);
  const expanded = useMemo(() => (expandedKeys ? new Set(expandedKeys) : null), [expandedKeys]);
  // Collapsing removes points, and the flame series' data labels (drawn through
  // the line series' renderer) outlive their points on an in-place update — so
  // remount the chart whenever the expansion changes. Live appends, which keep
  // this signature, still update in place.
  const expandSig = useMemo(
    () => (expandedKeys ? expandedKeys.slice().sort().join('|') : 'all'),
    [expandedKeys],
  );

  // While any span is still running, advance a 1s ticker so the open bars'
  // right edge (which extends to "now") animates live.
  const hasRunning = useMemo(() => flatten(tree, 0, []).some(f => !f.span.end_time), [tree]);
  useEffect(() => {
    if (!hasRunning) return undefined;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [hasRunning]);

  const { options, hasData } = useMemo(() => {
    const flat = flatten(tree, 0, [], expanded);
    if (!flat.length) return { options: null, hasData: false };

    // baseline = earliest start; running spans extend to "now".
    const now = Date.now();
    const starts = flat.map(f => new Date(f.span.start_time).getTime());
    const baseline = Math.min(...starts);

    // A logarithmic axis cannot render values <= 0 (Highcharts error #10), and
    // the earliest span (the harness.run root, plus anything starting at the
    // baseline) has low === 0. Floor the plotted range to the axis minimum in
    // log mode; the true duration is kept in custom.durationMs for the tooltip.
    const logMin = 1;

    const categories = [];
    const hiddenCounts = [];
    const data = [];
    flat.forEach((f, i) => {
      const s = f.span;
      const start = new Date(s.start_time).getTime();
      const end = s.end_time ? new Date(s.end_time).getTime() : now;
      const running = !s.end_time;
      const rawLow = start - baseline;
      const rawHigh = Math.max(end - baseline, rawLow + 1);
      const low = scale === 'log' ? Math.max(rawLow, logMin) : rawLow;
      const high = scale === 'log' ? Math.max(rawHigh, low + 1) : rawHigh;
      // a collapsed row stands in for its whole subtree: the axis label carries
      // the ellipsis and hidden-span count (see the label formatter below), and
      // the bar is outlined
      categories.push(`${'  '.repeat(f.depth)}${s.name || s.span_kind}`);
      hiddenCounts.push(f.hidden);
      data.push({
        x: i,
        low,
        high,
        name: s.name || s.span_kind,
        color: running ? '#cbd5e1' : (KIND_COLORS[s.span_kind] || '#94a3b8'),
        borderColor: f.hidden ? '#334155' : undefined,
        borderWidth: f.hidden ? 1 : 0,
        dashStyle: f.hidden ? 'ShortDash' : undefined,
        spanId: s.span_id,
        custom: { running, durationMs: rawHigh - rawLow, hidden: f.hidden },
      });
    });

    return {
      hasData: true,
      options: {
        // animation off: live updates patch the chart every second while spans
        // run — replaying the intro animation on each update reads as flicker
        chart: {
          type: 'flame',
          inverted: true,
          height: flat.length * ROW_H + AXIS_H,
          marginTop: 0,
          marginBottom: AXIS_H,
          animation: false,
        },
        title: { text: null },
        credits: { enabled: false },
        legend: { enabled: false },
        xAxis: {
          categories,
          reversed: true,
          labels: {
            useHTML: true,
            style: { fontSize: '11px' },
            // "name … +12" — the count is the number of spans folded into the row
            formatter: function () {
              const n = hiddenCounts[this.pos];
              const name = escapeHtml(this.value);
              return n
                ? `${name}<span style="color:#d46b08;font-weight:600">${NBSP}…${NBSP}+${n}</span>`
                : name;
            },
          },
        },
        yAxis: {
          type: scale === 'log' ? 'logarithmic' : 'linear',
          title: { text: 'ms since start' },
          min: scale === 'log' ? 1 : 0,
        },
        tooltip: {
          useHTML: true,
          formatter: function () {
            const c = this.point.custom || {};
            const dur = c.durationMs != null ? c.durationMs : (this.point.high - this.point.low);
            const r = c.running ? ' (running)' : '';
            const h = c.hidden ? `<br/><span style="color:#64748b">collapsed \u2014 ${c.hidden} span${c.hidden > 1 ? 's' : ''} hidden</span>` : '';
            return `<b>${escapeHtml(this.point.name)}</b><br/>${dur} ms${r}${h}`;
          },
        },
        plotOptions: {
          series: {
            animation: false,
            cursor: 'pointer',
            point: {
              events: {
                click: function () { dispatch(selectSpan(this.spanId)); },
              },
            },
          },
        },
        series: [{ name: 'spans', data, borderRadius: 2 }],
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree, scale, expanded, dispatch, selectedSpanId, tick]);

  if (!hasData) {
    return <div style={{ padding: 24, color: 'rgba(0,0,0,0.45)' }}>No spans yet.</div>;
  }

  return <HighchartsReact key={expandSig} highcharts={Highcharts} options={options} />;
}
