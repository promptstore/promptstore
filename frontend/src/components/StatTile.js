import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';

// A KPI tile: label, big value, optional period-over-period delta, optional
// sparkline. Text wears ink tokens (never a series color); the delta pairs a
// colored figure with an arrow glyph so direction is never color-alone.

const INK = { primary: '#0b0b0b', secondary: '#52514e', muted: '#898781', border: 'rgba(11,11,11,0.10)', spark: '#2a78d6' };
const GOOD = '#006300';   // success text (light surface)
const BAD = '#d03b3b';    // critical

// delta: fraction change vs prior period (e.g. +0.12 = +12%). goodWhenNegative
// flips the sense for "lower is better" metrics like cost.
function DeltaBadge({ delta, goodWhenNegative }) {
  if (delta == null || !isFinite(delta)) return null;
  const up = delta > 0;
  const good = goodWhenNegative ? delta < 0 : delta > 0;
  const color = delta === 0 ? INK.muted : (good ? GOOD : BAD);
  const arrow = delta === 0 ? '→' : (up ? '↑' : '↓');
  return (
    <span style={{ color, fontSize: 12, fontWeight: 600, marginLeft: 8, whiteSpace: 'nowrap' }}>
      {arrow} {Math.abs(delta * 100).toFixed(0)}%
    </span>
  );
}

function Sparkline({ data }) {
  if (!data || data.length < 2) return null;
  const options = {
    chart: { type: 'area', height: 34, margin: [2, 0, 2, 0], backgroundColor: 'transparent' },
    title: { text: null }, credits: { enabled: false }, legend: { enabled: false },
    xAxis: { visible: false }, yAxis: { visible: false },
    tooltip: { enabled: false },
    plotOptions: {
      series: {
        animation: false, lineWidth: 1.5, color: INK.spark, marker: { enabled: false },
        fillOpacity: 0.12, states: { hover: { enabled: false } },
      },
    },
    series: [{ data }],
  };
  return <HighchartsReact highcharts={Highcharts} options={options} />;
}

export default function StatTile({ label, value, delta, goodWhenNegative, sparkData, footer }) {
  return (
    <div style={{ border: `1px solid ${INK.border}`, borderRadius: 8, padding: '12px 14px', background: '#fff', minWidth: 150, flex: 1 }}>
      <div style={{ color: INK.muted, fontSize: 12 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 2 }}>
        <span style={{ color: INK.primary, fontSize: 22, fontWeight: 600 }}>{value}</span>
        <DeltaBadge delta={delta} goodWhenNegative={goodWhenNegative} />
      </div>
      {sparkData ? <div style={{ marginTop: 4 }}><Sparkline data={sparkData} /></div> : null}
      {footer ? <div style={{ color: INK.secondary, fontSize: 11, marginTop: 4 }}>{footer}</div> : null}
    </div>
  );
}
