import { useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Empty, Tag } from 'antd';
import ReactFlow, { Background, Controls, MarkerType } from 'reactflow';

import { selectSubAgentGraph, selectSelectedSpanId, selectSpan } from '../harnessTracesSlice';
import { KIND_COLORS } from './Waterfall';

import 'reactflow/dist/style.css';

const NODE_W = 220;
const LEVEL_X = 280;
const LEVEL_Y = 130;

// Layered layout: depth = distance to the root agent; siblings spread on Y.
function layout(agents) {
  const byId = {};
  agents.forEach(a => { byId[a.id] = a; });
  const depthOf = (a) => {
    let d = 0, cur = a, guard = 0;
    while (cur && cur.parentId && byId[cur.parentId] && guard < 100) { d++; cur = byId[cur.parentId]; guard++; }
    return d;
  };
  const levels = {};
  agents.forEach(a => {
    const d = depthOf(a);
    (levels[d] = levels[d] || []).push(a);
  });
  const pos = {};
  Object.entries(levels).forEach(([d, nodes]) => {
    nodes
      .sort((a, b) => (a.startTime < b.startTime ? -1 : a.startTime > b.startTime ? 1 : 0))
      .forEach((a, i) => { pos[a.id] = { x: Number(d) * LEVEL_X, y: i * LEVEL_Y }; });
  });
  return pos;
}

function nodeLabel(agent) {
  return (
    <div style={{ fontSize: 12, lineHeight: 1.4 }}>
      <div style={{ fontWeight: 600 }}>
        {agent.running ? '● ' : ''}{agent.label}
      </div>
      <div style={{ color: 'rgba(0,0,0,0.55)' }}>
        {agent.kind === 'subagent.spawn' ? 'sub-agent' : 'run'}
        {agent.durationMs != null ? ` · ${agent.durationMs} ms` : ' · running'}
      </div>
      <div>
        <Tag style={{ marginInlineEnd: 2 }}>{agent.tokens} tok</Tag>
        <Tag>${Number(agent.cost || 0).toFixed(4)}</Tag>
      </div>
      {agent.childTraceId ? (
        <div style={{ color: '#1677ff', fontSize: 11 }}>double-click to open ↗</div>
      ) : null}
    </div>
  );
}

export default function SubAgentGraph() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const agents = useSelector(selectSubAgentGraph);
  const selectedSpanId = useSelector(selectSelectedSpanId);

  const { nodes, edges } = useMemo(() => {
    if (!agents.length) return { nodes: [], edges: [] };
    const pos = layout(agents);
    const nodes = agents.map(a => ({
      id: a.id,
      position: pos[a.id] || { x: 0, y: 0 },
      data: { label: nodeLabel(a), childTraceId: a.childTraceId },
      style: {
        width: NODE_W,
        borderRadius: 8,
        border: `2px solid ${a.id === selectedSpanId ? '#1677ff' : (KIND_COLORS[a.kind] || '#94a3b8')}`,
        background: a.status === 'error' ? '#fff1f0' : '#fff',
        padding: 8,
      },
    }));
    const edges = agents
      .filter(a => a.parentId)
      .map(a => ({
        id: `${a.parentId}->${a.id}`,
        source: a.parentId,
        target: a.id,
        animated: a.running,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: '#94a3b8' },
      }));
    return { nodes, edges };
  }, [agents, selectedSpanId]);

  if (!agents.length) {
    return <Empty description="No agents yet" />;
  }

  return (
    <div style={{ height: 480, border: '1px solid #f0f0f0', borderRadius: 8 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        onNodeClick={(_, node) => dispatch(selectSpan(node.id))}
        onNodeDoubleClick={(_, node) => {
          if (node.data.childTraceId) navigate(`/harness/${node.data.childTraceId}`);
        }}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
