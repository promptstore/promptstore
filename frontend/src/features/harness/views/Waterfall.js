import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Segmented } from 'antd';
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

function flatten(nodes, depth, out) {
  for (const n of nodes) {
    out.push({ span: n, depth });
    if (n.children && n.children.length) flatten(n.children, depth + 1, out);
  }
  return out;
}

export default function Waterfall() {
  const dispatch = useDispatch();
  const tree = useSelector(selectSpanTree);
  const selectedSpanId = useSelector(selectSelectedSpanId);
  const [scale, setScale] = useState('linear');
  const [tick, setTick] = useState(0);

  // While any span is still running, advance a 1s ticker so the open bars'
  // right edge (which extends to "now") animates live.
  const hasRunning = useMemo(() => flatten(tree, 0, []).some(f => !f.span.end_time), [tree]);
  useEffect(() => {
    if (!hasRunning) return undefined;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [hasRunning]);

  const { options, hasData } = useMemo(() => {
    const flat = flatten(tree, 0, []);
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
      categories.push(`${'  '.repeat(f.depth)}${s.name || s.span_kind}`);
      data.push({
        x: i,
        low,
        high,
        name: s.name || s.span_kind,
        color: running ? '#cbd5e1' : (KIND_COLORS[s.span_kind] || '#94a3b8'),
        spanId: s.span_id,
        custom: { running, durationMs: rawHigh - rawLow },
      });
    });

    return {
      hasData: true,
      options: {
        // animation off: live updates patch the chart every second while spans
        // run — replaying the intro animation on each update reads as flicker
        chart: { type: 'flame', inverted: true, height: Math.max(220, flat.length * 26 + 80), animation: false },
        title: { text: null },
        credits: { enabled: false },
        legend: { enabled: false },
        xAxis: { categories, reversed: true, labels: { style: { fontSize: '11px' } } },
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
            return `<b>${this.point.name}</b><br/>${dur} ms${r}`;
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
  }, [tree, scale, dispatch, selectedSpanId, tick]);

  if (!hasData) {
    return <div style={{ padding: 24, color: 'rgba(0,0,0,0.45)' }}>No spans yet.</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: 8, textAlign: 'right' }}>
        <Segmented
          size="small"
          value={scale}
          onChange={setScale}
          options={[{ label: 'Linear', value: 'linear' }, { label: 'Log', value: 'log' }]}
        />
      </div>
      <HighchartsReact highcharts={Highcharts} options={options} />
    </div>
  );
}
