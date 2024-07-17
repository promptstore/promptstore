import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button, Col, Descriptions, Drawer, Row, Segmented, Tree } from 'antd';
import { DownloadOutlined, DownOutlined } from '@ant-design/icons';
import * as dayjs from 'dayjs';
import snakeCase from 'lodash.snakecase';
import ReactFlow, { Controls, ReactFlowProvider } from 'reactflow';
import Highcharts from 'highcharts';
import more from 'highcharts/highcharts-more';
// import sunburst from 'highcharts/modules/sunburst.js';
import HighchartsReact from 'highcharts-react-official';

import Download from '../../components/Download';
import NavbarContext from '../../contexts/NavbarContext';

import { Governance } from './Governance';
import BinNode from './BinNode';
import DataSourceNode from './DataSourceNode';
import DocumentNode from './DocumentNode';
import ModelNode from './ModelNode';
import PromptSetNode from './PromptSetNode';
import SemanticSearchNode from './SemanticSearchNode';
import { Status } from './Status';
import { Inspector } from './inspectors';
import {
  getTraceAsync,
  selectLoaded,
  selectTraces,
} from './tracesSlice';

const TIME_FORMAT = 'YYYY-MM-DDTHH-mm-ss';

more(Highcharts);
// sunburst(Highcharts);

const colors = Highcharts.getOptions().colors;

// Add new series type for the flame series
(function (H) {
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
      style: {
        textOutline: 'none',
        fontWeight: 'normal',
      },
    },
    point: {
      events: {
        click: function () {
          const point = this,
            chart = point.series.chart,
            series = point.series,
            xAxis = series.xAxis,
            yAxis = series.yAxis;

          xAxis.setExtremes(xAxis.min, point.x, false);
          yAxis.setExtremes(point.low, point.high, false);

          chart.showResetZoom();
          chart.redraw();
        },
      },
    },
    pointPadding: 0,
    groupPadding: 0
  }, {
    drawDataLabels: H.seriesTypes.line.prototype.drawDataLabels,
  });
}(Highcharts));

const nodeProps = {
  sourcePosition: 'right',
  targetPosition: 'left',
  style: { width: 200, height: 75 },
};

const binNodeProps = {
  sourcePosition: 'none',
  targetPosition: 'none',
  type: 'binNode',
};

const nodeTypes = {
  binNode: BinNode,
  dataSourceNode: DataSourceNode,
  documentNode: DocumentNode,
  modelNode: ModelNode,
  promptSetNode: PromptSetNode,
  semanticSearchNode: SemanticSearchNode,
};

const proOptions = { hideAttribution: true };

const reactFlowProps = {
  panOnDrag: true,
  panOnScroll: true,
  panOnScrollMode: 'horizontal',
  zoomOnScroll: false,
  zoomOnPinch: false,
  zoomOnDoubleClick: false,
  nodesDraggable: false,
  nodesConnectable: false,
};

export function TraceView() {

  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [scale, setScale] = useState('logarithmic');
  const [top, setTop] = useState(false);

  const traces = useSelector(selectTraces);
  const loaded = useSelector(selectLoaded);

  const { setNavbarState } = useContext(NavbarContext);

  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const latencyChart = useRef({});

  const id = location.pathname.match(/\/traces\/(.*)/)[1];
  const trace = traces[id];

  // console.log('trace:', trace);

  const step = useMemo(() => {
    const inner = (trace) => {
      for (const step of trace) {
        if (step.id === selectedKeys[0]) {
          const node = { ...step };
          delete node.children;
          return node;
        }
        if (step.children) {
          const match = inner(step.children);
          if (match) {
            return match;
          }
        }
      }
      return null;
    }

    if (trace && selectedKeys.length) {
      return inner(trace.trace);
    }
    return null;

  }, [selectedKeys, trace]);

  const getTitle = (step) => {
    if (step.type === 'call-function' || step.type === 'call-composition') {
      return step.type + ' - ' + step.function;
    } else if (step.type === 'map-args' && step.source) {
      let source = step.source.type;
      if (step.source.name) {
        source += ':' + step.source.name;
      }
      return step.type + ' - ' + source;
    }
    return step.type;
  };

  const treeData = useMemo(() => {
    if (trace) {
      const inner = (t, lvl = '') => {
        return t.map((step, i) => {
          let j = i + 1;
          if (step.children) {
            let num = lvl ? lvl + '.' + j : j;
            return {
              key: step.id,
              num,
              type: step.type,
              title: getTitle(step),
              children: inner(step.children, num),
            };
          }
          let num = lvl ? lvl + '.' + j : j;
          return {
            key: step.id,
            num,
            type: step.type,
            title: getTitle(step),
          };
        });
      }

      return inner(trace.trace);
    }
  }, [trace]);

  const addNodes = (nodes, edges, x, y, traces, parentNode) => {
    let i = 1;
    let prior;
    for (const trace of traces) {
      let node;
      if (trace.type === 'call-prompt-template') {
        node = {
          ...nodeProps,
          id: trace.id,
          data: {
            label: trace.type,
            promptSetId: trace.promptSetId,
            promptSetName: trace.promptSetName,
          },
          position: { x, y },
          type: 'promptSetNode',
        };
        x += 250;
      } else if (trace.type === 'call-model') {
        node = {
          ...nodeProps,
          id: trace.id,
          data: {
            label: trace.type,
            modelId: trace.modelId,
            modelName: trace.modelName,
          },
          position: { x, y },
          type: 'modelNode',
        };
        x += 250;
      } else if (trace.type === 'semantic-search-enrichment') {
        node = {
          ...nodeProps,
          id: trace.id,
          data: {
            label: trace.type,
            index: trace.index,
          },
          position: { x, y },
          type: 'semanticSearchNode',
        };
        let j = 100;
        for (const [k, v] of Object.entries(trace.sources)) {
          const id = `${trace.id}-${v.dataSourceId}`;
          const nd = {
            ...nodeProps,
            id,
            data: {
              label: 'data-source',
              dataSourceId: v.dataSourceId,
              dataSourceName: v.dataSourceName,
              hits: v.hits,
              indexName: trace.index.name,
              vectorStoreProvider: trace.index.params.vectorStoreProvider,
            },
            position: { x: x - 250, y: y + j },
            type: 'dataSourceNode',
          };
          nodes.push(nd);
          edges.push({
            id: `${id}-${trace.id}`,
            source: id,
            target: trace.id,
          });
          if (v.uploads) {
            for (const [key, doc] of Object.entries(v.uploads)) {
              const docId = `${trace.id}-${v.dataSourceId}-${key}`;
              const nd = {
                ...nodeProps,
                id: docId,
                data: {
                  label: 'document',
                  uploadId: doc.uploadId,
                  objectName: doc.objectName,
                },
                position: { x: x - 500, y: y + j },
                type: 'documentNode',
              };
              nodes.push(nd);
              edges.push({
                id: `${docId}-${id}`,
                source: docId,
                target: id,
              });
              j += 100;
            }
          } else {
            j += 100;
          }
        }
        x += 250;
      } else if (trace.type === 'batch-bin') {
        const id = 'bin-' + i;
        const size = trace.subNodes.length;
        const nd = {
          ...binNodeProps,
          id,
          data: {
            label: 'batch-bin-' + i,
          },
          position: { x, y },
          targetPosition: 'left',
          style: { background: 'none', width: size * 250, height: 140 },
        };
        nodes.push(nd);
        if (prior) {
          edges.push({
            id: `${prior.id}-${id}`,
            source: prior.id,
            target: id,
          });
        }
        prior = null;
        const ret = addNodes(nodes, edges, 25, 40, trace.subNodes, id);
        prior = ret.prior;
        i += 1;
        x += size * 250 + 25;
      }
      if (node) {
        if (parentNode) {
          node = { ...node, parentNode };
        }
        nodes.push(node);
        if (prior) {
          edges.push({
            id: `${prior.id}-${node.id}`,
            source: prior.id,
            target: node.id,
          });
        }
        prior = node;
      }
    }
    return { prior };
  }

  const graph = useMemo(() => {
    if (trace) {
      const nodes = [];
      const edges = [];
      const traces = [];
      getNodes(traces, trace.trace[0], [
        'batch-bin',
        'call-model',
        'call-prompt-template',
        'semantic-search-enrichment',
      ]);
      addNodes(nodes, edges, 25, 0, traces);

      return { nodes, edges };
    }

    return { nodes: [], edges: [] };
  }, [trace]);

  // console.log('graph:', graph);

  const getOptions = useCallback(() => {
    if (!trace) {
      return null;
    }

    const types = [];
    const baselineTime = trace.trace[0].startTime - 1;

    const inner = (children, parentStartTime, x = 1) => {
      const data = [];
      for (const child of children) {
        if (!types.includes(child.type)) {
          types.push(child.type);
        }
        const low = ((child.startTime || parentStartTime) - baselineTime);
        const high = ((child.endTime || parentStartTime + 1) - baselineTime);
        data.push({
          id: child.id,
          name: child.type,
          low,
          high,
          value: high - low,
          color: colors[types.indexOf(child.type)],
          x,
        });
        if (child.children?.length) {
          data.push(...inner(child.children, child.startTime, x + 1));
        }
      }
      return data;
    }

    const data = inner(trace.trace);

    return {
      chart: {
        inverted: true,
      },
      title: {
        align: 'left',
        text: 'Latency Profile',
      },
      legend: {
        enabled: false,
      },
      xAxis: [
        {
          visible: false,
        },
        {
          reversed: false,
          visible: false,
          startOnTick: false,
          endOnTick: false,
          minPadding: 0,
          maxPadding: 0,
        },
      ],
      yAxis: [
        {
          type: scale,
          visible: true,
          title: { text: 'Milliseconds' },
        },
        {
          visible: false,
          min: 0,
          maxPadding: 0,
          startOnTick: false,
          endOnTick: false,
        },
      ],
      tooltip: {
        headerFormat: '',
        pointFormat: '<b>{point.name}</b> latency is <b>{point.value}</b>',
      },
      series: [
        {
          visible: true,
          type: 'flame',
          data,
          // yAxis: 1,
          // xAxis: 1,
        },
        {
          visible: false,
          pointRange: 2,
          pointPlacement: 0.25,
          type: 'flame',
          data: [
            {
              name: 'root',
              id: '20',
              value: 1,
              color: colors[0],
              x: 0,
              low: 0,
              high: 10
            },
          ],
        },
        // {
        //   visible: false,
        //   // size: '100%',
        //   // type: 'sunburst',
        //   // data: [],
        //   allowDrillToNode: true,
        //   cursor: 'pointer',
        //   levels: [
        //     {
        //       level: 1,
        //       levelIsConstant: false,
        //       dataLabels: {
        //         enabled: false,
        //       },
        //     },
        //   ],
        //   dataLabels: {
        //     textPath: {
        //       attributes: {
        //         dy: 5,
        //       },
        //       enabled: true,
        //     },
        //   },
        // },
      ],
    };
  }, [scale, trace]);

  useEffect(() => {
    dispatch(getTraceAsync(id));

    return () => {
      setTop(false);
    };
  }, []);

  useEffect(() => {
    if (top && traces) {
      const latest = Object.values(traces).find(t => t.latest);
      if (latest) {
        navigate(`/traces/${latest.id}`);
      }
    }
  }, [traces]);

  useEffect(() => {
    if (trace) {
      const name = trace.name;
      const parts = name.split(' - ');
      const title = parts[0] + ' - ' + dayjs(parts[1]).format(TIME_FORMAT);
      setNavbarState((state) => ({
        ...state,
        createLink: null,
        title,
      }));
      setSelectedKeys([trace.trace[0].id]);
    }
  }, [trace]);

  useEffect(() => {
    const chart = latencyChart.current?.chart;
    if (chart) {
      chart.reflow(false);
    }
  }, [scale]);

  const handleNodeClick = () => { };

  const navigateTop = () => {
    dispatch(getTraceAsync('latest'));
    setTop(true);
  };

  const onSelect = (selectedKeys, info) => {
    // console.log('info:', info);
    const key = info.selectedNodes?.[0]?.key;
    if (key) {
      setSelectedKeys([key]);
    }
  };

  const options = useMemo(getOptions, [scale, trace]);
  // console.log('options:', options);

  if (!loaded) {
    return (
      <div style={{ marginTop: 20 }}>Loading...</div>
    );
  }
  return (
    <>
      <div style={{ marginTop: 20 }}>
        <Row gutter={16}>
          <Col span={6}>
            <Descriptions className="trace" title="Trace" column={1} layout="vertical">
              <Descriptions.Item span={1}>
                <Tree
                  showLine
                  switcherIcon={<DownOutlined />}
                  onSelect={onSelect}
                  treeData={treeData}
                  style={{ padding: '10px 15px' }}
                  defaultExpandAll={true}
                />
              </Descriptions.Item>
            </Descriptions>
          </Col>
          <Col span={14}>
            <div style={{ display: 'flex', flexDirection: 'row-reverse', gap: 16, alignItems: 'center' }}>
              <Download filename={snakeCase(trace.name) + '.json'} payload={trace}>
                <Button type="text" icon={<DownloadOutlined />}>
                  Export
                </Button>
              </Download>
              <Link onClick={navigateTop}>Top</Link>
              <Link to={`/traces`}>List</Link>
              <Link onClick={() => setProfileOpen(true)}>Profile</Link>
              <Link onClick={() => setOpen(true)}>Lineage</Link>
            </div>
            {step ?
              <Inspector step={step} />
              :
              <div></div>
            }
          </Col>
          {/* <Col span={4}>
          {step ?
            <Governance step={step} />
            :
            <div></div>
          }
        </Col> */}
          <Col span={4}>
            {step ?
              <Status step={step} username={trace.createdBy} />
              :
              <div></div>
            }
          </Col>
        </Row>
      </div>
      <Drawer
        title="Lineage"
        placement="bottom"
        closable={true}
        onClose={() => setOpen(false)}
        open={open}
      >
        <ReactFlowProvider>
          <ReactFlow
            {...reactFlowProps}
            nodes={graph.nodes}
            edges={graph.edges}
            onNodeClick={handleNodeClick}
            nodeTypes={nodeTypes}
            proOptions={proOptions}
          >
            <Controls position="bottom-right" />
          </ReactFlow>
        </ReactFlowProvider>
      </Drawer>
      <Drawer
        title="Profile"
        placement="bottom"
        closable={true}
        onClose={() => setProfileOpen(false)}
        open={profileOpen}
        height={'50%'}
      >
        {options ?
          <>
            <HighchartsReact
              ref={latencyChart}
              highcharts={Highcharts}
              options={options}
            />
            <Segmented
              onChange={setScale}
              value={scale}
              options={[
                {
                  label: 'Log scale',
                  value: 'logarithmic',
                },
                {
                  label: 'Linear scale',
                  value: 'linear',
                },
              ]}
            />
          </>
          : null
        }
      </Drawer>
    </>
  );
}

const getNode = (trace, type) => {
  if (trace.type === type) {
    return trace;
  }
  const children = trace.children || [];
  for (const child of children) {
    const node = getNode(child, type);
    if (node) return node;
  }
  return null;
}

const getNodes = (accum, trace, types) => {
  let acc = [];
  const children = trace.children || [];
  for (const child of children) {
    getNodes(acc, child, types);
  }
  if (trace.type === 'batch-bin') {
    accum.push({ ...trace, subNodes: acc });
  } else {
    if (types.includes(trace.type)) {
      accum.push(trace);
    }
    accum.push(...acc);
  }
}