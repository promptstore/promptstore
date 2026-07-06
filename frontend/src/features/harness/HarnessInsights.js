import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Card, DatePicker, Empty, Spin, Tag } from 'antd';
import { RightOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';

import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import { getInsightsAsync, selectInsights } from './harnessInsightsSlice';

const { RangePicker } = DatePicker;

const INK = { primary: '#0b0b0b', secondary: '#52514e', muted: '#898781', grid: '#e1e0d9', axis: '#c3c2b7' };
// status palette (fixed; paired with an icon + word so never color-alone)
const SEV = {
  critical: { color: '#d03b3b', icon: '⛔', label: 'Critical' },
  serious: { color: '#ec835a', icon: '▲', label: 'Serious' },
  warning: { color: '#fab219', icon: '⚠', label: 'Warning' },
  info: { color: '#2a78d6', icon: 'ℹ', label: 'Info' },
  good: { color: '#0ca30c', icon: '✓', label: 'Healthy' },
};

const baseChart = (height) => ({
  chart: { height, backgroundColor: 'transparent', spacing: [8, 8, 4, 4] },
  title: { text: null }, credits: { enabled: false }, legend: { enabled: false },
  xAxis: { lineColor: INK.axis, tickLength: 0, labels: { style: { color: INK.muted, fontSize: '10px' } } },
  yAxis: { gridLineColor: INK.grid, title: { text: null }, labels: { style: { color: INK.muted, fontSize: '10px' } } },
  plotOptions: { series: { animation: false } },
});

function InsightCard({ card, onOpen }) {
  const sev = SEV[card.severity] || SEV.info;
  const clickable = !!card.traceId;
  return (
    <Card
      size="small"
      hoverable={clickable}
      onClick={clickable ? () => onOpen(card) : undefined}
      style={{ borderLeft: `4px solid ${sev.color}`, cursor: clickable ? 'pointer' : 'default' }}
      bodyStyle={{ padding: '10px 14px' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: sev.color }}>{sev.icon}</span>
        <span style={{ fontWeight: 600, color: INK.primary }}>{card.title}</span>
        <Tag color={card.severity === 'good' ? 'green' : card.severity === 'info' ? 'blue' : card.severity === 'warning' ? 'orange' : 'red'} style={{ marginInlineStart: 4 }}>
          {card.metric}
        </Tag>
        {clickable ? <span style={{ marginLeft: 'auto', color: INK.muted, fontSize: 12 }}>open trace <RightOutlined /></span> : null}
      </div>
      <div style={{ color: INK.secondary, fontSize: 13, marginTop: 4 }}>{card.finding}</div>
    </Card>
  );
}

// ---- diagnostic charts ------------------------------------------------------
function LoopHistogram({ data }) {
  const options = useMemo(() => ({
    ...baseChart(220),
    chart: { ...baseChart(220).chart, type: 'column' },
    xAxis: { ...baseChart(220).xAxis, categories: data.map(d => String(d.turns)), title: { text: 'turns / run', style: { color: INK.muted } } },
    tooltip: { pointFormat: '{point.y} run(s)' },
    series: [{ data: data.map(d => d.count), color: '#2a78d6', borderColor: '#fff', borderWidth: 1 }],
  }), [data]);
  return <HighchartsReact highcharts={Highcharts} options={options} />;
}

function ToolChart({ data }) {
  const options = useMemo(() => ({
    ...baseChart(Math.max(160, data.length * 34 + 60)),
    chart: { ...baseChart(220).chart, type: 'bar' },
    xAxis: { ...baseChart(220).xAxis, categories: data.map(d => d.name) },
    yAxis: { ...baseChart(220).yAxis, max: 100, title: { text: 'error rate %', style: { color: INK.muted } } },
    tooltip: {
      useHTML: true,
      formatter: function () { const d = data[this.point.index]; return `<b>${d.name}</b><br/>${d.calls} calls · ${Math.round(d.errorRate * 100)}% errors · p95 ${d.p95Ms} ms`; },
    },
    series: [{
      data: data.map(d => ({ y: Math.round(d.errorRate * 100), color: d.errorRate >= 0.3 ? '#d03b3b' : d.errorRate >= 0.1 ? '#fab219' : '#1baf7a' })),
      borderColor: '#fff', borderWidth: 1,
    }],
  }), [data]);
  return <HighchartsReact highcharts={Highcharts} options={options} />;
}

function CacheTrend({ data }) {
  const options = useMemo(() => ({
    ...baseChart(220),
    chart: { ...baseChart(220).chart, type: 'line' },
    xAxis: { ...baseChart(220).xAxis, categories: data.map(d => d.bucket) },
    yAxis: { ...baseChart(220).yAxis, max: 100, title: { text: 'cache-hit %', style: { color: INK.muted } } },
    tooltip: { valueSuffix: '%' },
    series: [{ data: data.map(d => Math.round(d.rate * 100)), color: '#008300', lineWidth: 2, marker: { enabled: true, radius: 3 } }],
  }), [data]);
  return <HighchartsReact highcharts={Highcharts} options={options} />;
}

export function HarnessInsights() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);
  const workspaceId = selectedWorkspace && selectedWorkspace.id;

  const { loading, insights, charts } = useSelector(selectInsights);
  const [range, setRange] = useState([dayjs().subtract(30, 'day'), dayjs()]);
  const from = range[0].startOf('day').toISOString();
  const to = range[1].endOf('day').toISOString();

  useEffect(() => { setNavbarState(s => ({ ...s, createLink: null, title: 'Harness Insights' })); }, []);
  useEffect(() => {
    if (workspaceId) dispatch(getInsightsAsync({ workspaceId, from, to }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, from, to]);

  const onOpen = (card) => { if (card.traceId) navigate(`/harness/${card.traceId}`); };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 16 }}>
        <RangePicker value={range} onChange={(r) => r && setRange(r)} allowClear={false} />
      </div>
      <Spin spinning={loading}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* left: ranked insight cards */}
          <div style={{ flex: '1 1 460px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {insights.length ? insights.map(c => <InsightCard key={c.id} card={c} onOpen={onOpen} />)
              : <Empty description="No insights for this range" />}
          </div>
          {/* right: diagnostic charts */}
          <div style={{ flex: '1 1 420px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card size="small" title="Loop length (turns per run)" bodyStyle={{ padding: 8 }}>
              {charts?.loopLength?.length ? <LoopHistogram data={charts.loopLength} /> : <div style={{ color: INK.muted, padding: 16 }}>No runs.</div>}
            </Card>
            <Card size="small" title="Tool error rate" bodyStyle={{ padding: 8 }}>
              {charts?.toolStats?.length ? <ToolChart data={charts.toolStats} /> : <div style={{ color: INK.muted, padding: 16 }}>No tool calls.</div>}
            </Card>
            <Card size="small" title="Cache-hit trend" bodyStyle={{ padding: 8 }}>
              {charts?.cacheHitTrend?.length ? <CacheTrend data={charts.cacheHitTrend} /> : <div style={{ color: INK.muted, padding: 16 }}>No token data.</div>}
            </Card>
          </div>
        </div>
      </Spin>
    </div>
  );
}
