import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button, Col, Descriptions, Drawer, Row, Tree } from 'antd';
import { DownloadOutlined, DownOutlined } from '@ant-design/icons';
import * as dayjs from 'dayjs';
import snakeCase from 'lodash.snakecase';
import ReactFlow, { ReactFlowProvider } from 'reactflow';

import Download from '../../components/Download';
import NavbarContext from '../../contexts/NavbarContext';

import { Governance } from './Governance';
import { Status } from './Status';
import { Inspector } from './inspectors';
import {
  getTraceAsync,
  selectLoaded,
  selectTraces,
} from './tracesSlice';

const TIME_FORMAT = 'YYYY-MM-DDTHH-mm-ss';

const nodeProps = {
  sourcePosition: 'right',
  targetPosition: 'left',
  style: { width: 200 },
};

const reactFlowProps = {
  panOnDrag: false,
  panOnScroll: false,
  zoomOnScroll: false,
  zoomOnPinch: false,
  zoomOnDoubleClick: false,
  nodesDraggable: false,
  nodesConnectable: false,
};

const proOptions = { hideAttribution: true };

export function TraceView() {

  const [open, setOpen] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [top, setTop] = useState(false);

  const traces = useSelector(selectTraces);
  const loaded = useSelector(selectLoaded);

  const { setNavbarState } = useContext(NavbarContext);

  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

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

  const graph = useMemo(() => {
    if (trace) {
      const nodes = [];
      const edges = [];
      let x = 0;
      let y = 0;
      let prior;
      const enrichmentPipeline = getNode(trace.trace[0], 'enrichment-pipeline');
      // console.log('enrichmentPipeline:', enrichmentPipeline);
      if (enrichmentPipeline) {
        for (const step of enrichmentPipeline.children) {
          const node = {
            id: step.id,
            data: {
              label: step.type,
            },
            position: { x, y },
            ...nodeProps,
          };
          if (x === 0) {
            node.type = 'input';
          }
          nodes.push(node);
          if (prior) {
            edges.push({
              id: `${prior.id}-${step.id}`,
              source: prior.id,
              target: step.id,
            });
          }
          prior = node;
          x += 250;
        }
      }
      const callModel = getNode(trace.trace[0], 'call-model');
      if (callModel) {
        const node = {
          id: callModel.id,
          data: {
            label: callModel.type,
          },
          position: { x, y },
          type: 'output',
          ...nodeProps,
        };
        nodes.push(node);
        if (prior) {
          edges.push({
            id: `${prior.id}-${callModel.id}`,
            source: prior.id,
            target: callModel.id,
          });
        }
        prior = node;
        x += 250;
      }
      return { nodes, edges };
    }
    return { nodes: [], edges: [] };
  }, [trace]);

  // console.log('graph:', graph);

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

  const handleNodeClick = () => { };

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
                  Download
                </Button>
              </Download>
              <Link onClick={navigateTop}>Top</Link>
              <Link to={`/traces`}>List</Link>
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
            proOptions={proOptions}
          />
        </ReactFlowProvider>
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