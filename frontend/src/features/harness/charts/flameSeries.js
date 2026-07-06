import Highcharts from 'highcharts';
import more from 'highcharts/highcharts-more';

// Registers the custom 'flame' Highcharts series (a columnrange with centered
// data labels) used to render a span waterfall/flame timeline. Extracted from
// features/traces/TraceView.js so both the legacy and harness views share one
// definition. Idempotent — safe to import from multiple modules.

let registered = false;

export function registerFlameSeries() {
  if (registered) return;
  registered = true;
  more(Highcharts);
  (function (H) {
    if (H.seriesTypes.flame) return;
    H.seriesType('flame', 'columnrange', {
      cursor: 'pointer',
      dataLabels: {
        enabled: true,
        format: '{point.name}',
        inside: true,
        align: 'center',
        crop: true,
        overflow: 'none',
        color: 'black',
        style: { textOutline: 'none', fontWeight: 'normal' },
      },
      point: {
        events: {
          click: function () {
            const point = this;
            const chart = point.series.chart;
            const series = point.series;
            const xAxis = series.xAxis;
            const yAxis = series.yAxis;
            xAxis.setExtremes(xAxis.min, point.x, false);
            yAxis.setExtremes(point.low, point.high, false);
            chart.showResetZoom();
            chart.redraw();
          },
        },
      },
      pointPadding: 0,
      groupPadding: 0,
    }, {
      drawDataLabels: H.seriesTypes.line.prototype.drawDataLabels,
    });
  }(Highcharts));
}

export default Highcharts;
