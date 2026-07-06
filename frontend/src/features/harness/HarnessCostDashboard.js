import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Button, Card, DatePicker, Form, InputNumber, Popconfirm, Segmented, Select, Space, Table, Tag } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import sunburst from 'highcharts/modules/sunburst';

import StatTile from '../../components/StatTile';
import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';

import {
  loadCostDashboardAsync,
  getCostSummaryAsync,
  saveBudgetAsync,
  deleteBudgetAsync,
  selectCost,
} from './harnessCostSlice';

sunburst(Highcharts);

const { RangePicker } = DatePicker;

// validated categorical palette (fixed order — never cycled)
const SERIES = ['#2a78d6', '#1baf7a', '#eda100', '#008300', '#4a3aa7', '#e34948', '#e87ba4', '#eb6834'];
const INK = { primary: '#0b0b0b', secondary: '#52514e', muted: '#898781', grid: '#e1e0d9', axis: '#c3c2b7' };
const STATUS = { good: '#0ca30c', warning: '#fab219', critical: '#d03b3b' };

const usd = (n) => '$' + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usd4 = (n) => '$' + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
const num = (n) => Number(n || 0).toLocaleString();
const ratio = (a, b) => (b ? a / b : null);
const rel = (cur, prev) => (prev ? (cur - prev) / prev : null);

const baseChart = (height) => ({
  chart: { height, backgroundColor: 'transparent', spacing: [8, 8, 4, 4] },
  title: { text: null }, credits: { enabled: false },
  legend: { itemStyle: { color: INK.secondary, fontWeight: 'normal', fontSize: '11px' } },
  xAxis: { lineColor: INK.axis, tickLength: 0, labels: { style: { color: INK.muted, fontSize: '10px' } } },
  yAxis: { gridLineColor: INK.grid, title: { text: null }, labels: { style: { color: INK.muted, fontSize: '10px' } } },
  plotOptions: { series: { animation: false } },
});

// ---- charts -----------------------------------------------------------------
function useSpendOverTime(summary) {
  return useMemo(() => {
    if (!summary || !summary.data.length) return null;
    const buckets = [...new Set(summary.data.map(r => r.bucket))].sort();
    const groups = [...new Set(summary.data.map(r => r.group))];
    const byKey = {};
    summary.data.forEach(r => { byKey[`${r.bucket}|${r.group}`] = r.cost; });
    const series = groups.map((g, i) => ({
      name: g, color: SERIES[i % SERIES.length], borderColor: '#fff', borderWidth: 1,
      data: buckets.map(b => byKey[`${b}|${g}`] || 0),
    }));
    return {
      ...baseChart(260),
      chart: { ...baseChart(260).chart, type: 'column' },
      xAxis: { ...baseChart(260).xAxis, categories: buckets },
      yAxis: { ...baseChart(260).yAxis, title: { text: 'USD', style: { color: INK.muted } } },
      tooltip: { valuePrefix: '$', valueDecimals: 4, shared: false },
      plotOptions: { column: { stacking: 'normal' }, series: { animation: false } },
      series,
    };
  }, [summary]);
}

function useTokenBreakdown(summary) {
  return useMemo(() => {
    if (!summary || !summary.data.length) return null;
    const buckets = [...new Set(summary.data.map(r => r.bucket))].sort();
    const agg = {};   // bucket -> {prompt, completion, cached, reasoning}
    buckets.forEach(b => { agg[b] = { prompt: 0, completion: 0, cached: 0, reasoning: 0 }; });
    summary.data.forEach(r => {
      const a = agg[r.bucket];
      a.prompt += r.prompt_tokens - r.cached_tokens;   // uncached prompt
      a.cached += r.cached_tokens;
      a.completion += r.completion_tokens - r.reasoning_tokens;
      a.reasoning += r.reasoning_tokens;
    });
    const defs = [
      { key: 'prompt', name: 'prompt (uncached)', color: SERIES[0] },
      { key: 'cached', name: 'cached prompt', color: SERIES[3] },
      { key: 'completion', name: 'completion', color: SERIES[1] },
      { key: 'reasoning', name: 'reasoning', color: SERIES[4] },
    ];
    return {
      ...baseChart(260),
      // column (not area) so a single time bucket — the common case when a run
      // spans one day — still renders visible bars
      chart: { ...baseChart(260).chart, type: 'column' },
      xAxis: { ...baseChart(260).xAxis, categories: buckets },
      yAxis: { ...baseChart(260).yAxis, title: { text: 'tokens', style: { color: INK.muted } } },
      tooltip: { shared: true },
      plotOptions: { column: { stacking: 'normal', borderColor: '#fff', borderWidth: 1 }, series: { animation: false } },
      series: defs.map(d => ({ name: d.name, color: d.color, data: buckets.map(b => Math.max(agg[b][d.key], 0)) })),
    };
  }, [summary]);
}

function useDistribution(distribution) {
  return useMemo(() => {
    if (!distribution || !distribution.length) return null;
    const data = [{ id: 'root', parent: '', name: 'total' }];
    const providers = [...new Set(distribution.map(d => d.provider))];
    providers.forEach((p, i) => data.push({ id: `p:${p}`, parent: 'root', name: p, color: SERIES[i % SERIES.length] }));
    distribution.forEach(d => data.push({ id: `m:${d.provider}/${d.model}`, parent: `p:${d.provider}`, name: d.model, value: d.cost }));
    return {
      chart: { height: 300, backgroundColor: 'transparent' },
      title: { text: null }, credits: { enabled: false },
      tooltip: { useHTML: true, pointFormatter: function () { return `<b>${this.name}</b>: ${usd4(this.value)}`; } },
      series: [{
        type: 'sunburst', data, allowTraversingTree: true,
        levels: [
          { level: 1, colorByPoint: false },
          { level: 2, colorByPoint: true },
          { level: 3, levelIsConstant: false, dataLabels: { enabled: false } },
        ],
        dataLabels: { style: { textOutline: 'none', color: '#fff', fontSize: '10px' } },
      }],
    };
  }, [distribution]);
}

// ---- budgets ----------------------------------------------------------------
function BudgetPanel({ workspaceId, budgets, status }) {
  const dispatch = useDispatch();
  const [form] = Form.useForm();
  const statusById = useMemo(() => Object.fromEntries(status.map(s => [s.id, s])), [status]);

  const onAdd = async () => {
    const v = await form.validateFields();
    await dispatch(saveBudgetAsync({ workspaceId, budget: { period: v.period, limitAmount: v.limitAmount, alertThresholds: [0.8, 1.0] } }));
    form.resetFields();
  };

  return (
    <Card size="small" title="Budgets" bodyStyle={{ padding: 12 }}>
      {budgets.map(b => {
        const st = statusById[b.id] || {};
        const used = st.used || 0;
        const color = st.over ? STATUS.critical : (used >= 0.8 ? STATUS.warning : STATUS.good);
        return (
          <div key={b.id} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <b style={{ color: INK.primary }}>{b.period}</b>
              <span style={{ color: INK.secondary }}>{usd(st.spend)} / {usd(b.limitAmount)}</span>
              <Tag color={st.over ? 'red' : used >= 0.8 ? 'orange' : 'green'} style={{ marginInlineStart: 'auto' }}>
                {st.over ? 'OVER' : `${Math.round(used * 100)}%`}
              </Tag>
              <Popconfirm title="Delete budget?" onConfirm={() => dispatch(deleteBudgetAsync({ workspaceId, id: b.id }))}>
                <Button size="small" type="text" icon={<DeleteOutlined />} />
              </Popconfirm>
            </div>
            <div style={{ height: 8, background: INK.grid, borderRadius: 4, marginTop: 4, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(used * 100, 100)}%`, height: '100%', background: color }} />
            </div>
          </div>
        );
      })}
      <Form form={form} layout="inline" initialValues={{ period: 'month' }} style={{ marginTop: 8 }}>
        <Form.Item name="period"><Select size="small" style={{ width: 90 }} options={[{ value: 'month', label: 'Monthly' }, { value: 'day', label: 'Daily' }]} /></Form.Item>
        <Form.Item name="limitAmount" rules={[{ required: true }]}><InputNumber size="small" prefix="$" min={0} placeholder="limit" style={{ width: 110 }} /></Form.Item>
        <Form.Item><Button size="small" onClick={onAdd}>Add budget</Button></Form.Item>
      </Form>
    </Card>
  );
}

// ---- container --------------------------------------------------------------
export function HarnessCostDashboard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);
  const workspaceId = selectedWorkspace && selectedWorkspace.id;

  const cost = useSelector(selectCost);
  const [range, setRange] = useState([dayjs().subtract(30, 'day'), dayjs()]);
  const [groupBy, setGroupBy] = useState('model');

  const from = range[0].startOf('day').toISOString();
  const to = range[1].endOf('day').toISOString();

  useEffect(() => { setNavbarState(s => ({ ...s, createLink: null, title: 'Cost & Usage' })); }, []);

  useEffect(() => {
    if (workspaceId) dispatch(loadCostDashboardAsync({ workspaceId, from, to, groupBy }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, from, to]);

  useEffect(() => {
    if (workspaceId) dispatch(getCostSummaryAsync({ workspaceId, from, to, groupBy }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupBy]);

  const spendChart = useSpendOverTime(cost.summary);
  const tokenChart = useTokenBreakdown(cost.summary);
  const distChart = useDistribution(cost.distribution);

  const kpis = cost.kpis;
  const cur = kpis ? kpis.current : {};
  const prev = kpis ? kpis.previous : {};
  const spendSpark = useMemo(() => {
    if (!cost.summary) return null;
    const byBucket = {};
    cost.summary.data.forEach(r => { byBucket[r.bucket] = (byBucket[r.bucket] || 0) + r.cost; });
    return Object.keys(byBucket).sort().map(b => byBucket[b]);
  }, [cost.summary]);

  const cacheCur = ratio(cur.cached_tokens, cur.prompt_tokens);
  const cachePrev = ratio(prev.cached_tokens, prev.prompt_tokens);
  const primaryBudget = cost.budgetStatus[0];

  const perRunCols = [
    { title: 'Run', dataIndex: 'name', render: (n, r) => <a onClick={() => navigate(`/harness/${r.trace_id}`)}>{n || r.trace_id.slice(0, 12)}</a> },
    { title: 'Cost', dataIndex: 'cost_total', width: 110, sorter: (a, b) => a.cost_total - b.cost_total, render: usd4 },
    { title: 'Tokens', dataIndex: 'total_tokens', width: 110, render: num },
    { title: 'Turns', dataIndex: 'turns', width: 70 },
    { title: 'Started', dataIndex: 'start_time', width: 160, render: (t) => dayjs(t).format('MM-DD HH:mm') },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Space style={{ marginBottom: 16 }} wrap>
        <RangePicker value={range} onChange={(r) => r && setRange(r)} allowClear={false} />
        <span style={{ color: INK.muted }}>stack by</span>
        <Segmented value={groupBy} onChange={setGroupBy} options={[{ label: 'Model', value: 'model' }, { label: 'Provider', value: 'provider' }, { label: 'User', value: 'user' }]} />
      </Space>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <StatTile label="Total spend" value={usd(cur.cost)} delta={rel(cur.cost, prev.cost)} goodWhenNegative sparkData={spendSpark} />
        <StatTile label="Total tokens" value={num(cur.total_tokens)} delta={rel(cur.total_tokens, prev.total_tokens)} goodWhenNegative />
        <StatTile label="Avg cost / run" value={usd4(ratio(cur.cost, cur.runs) || 0)} delta={rel(ratio(cur.cost, cur.runs), ratio(prev.cost, prev.runs))} goodWhenNegative />
        <StatTile label="Cache-hit rate" value={cacheCur != null ? `${Math.round(cacheCur * 100)}%` : '—'} delta={rel(cacheCur, cachePrev)} />
        <StatTile label="Runs" value={num(cur.runs)} delta={rel(cur.runs, prev.runs)} />
        <StatTile
          label="Budget used"
          value={primaryBudget ? `${Math.round((primaryBudget.used || 0) * 100)}%` : '—'}
          goodWhenNegative
          footer={primaryBudget ? `${primaryBudget.period} · ${usd(primaryBudget.spend)} / ${usd(primaryBudget.limitAmount)}` : 'no budget set'}
        />
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Card size="small" title="Spend over time" style={{ flex: '1 1 420px' }} bodyStyle={{ padding: 8 }}>
          {spendChart ? <HighchartsReact highcharts={Highcharts} options={spendChart} /> : <div style={{ color: INK.muted, padding: 24 }}>No cost in range.</div>}
        </Card>
        <Card size="small" title="Token breakdown" style={{ flex: '1 1 420px' }} bodyStyle={{ padding: 8 }}>
          {tokenChart ? <HighchartsReact highcharts={Highcharts} options={tokenChart} /> : <div style={{ color: INK.muted, padding: 24 }}>No tokens in range.</div>}
        </Card>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 16 }}>
        <Card size="small" title="Cost by provider → model" style={{ flex: '1 1 360px' }} bodyStyle={{ padding: 8 }}>
          {distChart ? <HighchartsReact highcharts={Highcharts} options={distChart} /> : <div style={{ color: INK.muted, padding: 24 }}>No cost in range.</div>}
        </Card>
        <div style={{ flex: '1 1 300px' }}>
          <BudgetPanel workspaceId={workspaceId} budgets={cost.budgets} status={cost.budgetStatus} />
        </div>
      </div>

      <Card size="small" title="Cost per run" style={{ marginTop: 16 }} bodyStyle={{ padding: 0 }}>
        <Table rowKey="trace_id" size="small" columns={perRunCols} dataSource={cost.perRun} pagination={{ pageSize: 10 }} />
      </Card>
    </div>
  );
}
