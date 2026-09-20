import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import { Badge, Button, Col, ConfigProvider, Descriptions, Grid, Row, Segmented, Spin, Tag, Tree } from 'antd';
import { VerticalAlignBottomOutlined } from '@ant-design/icons';

import { JsonField, JsonView } from '../../components/JsonView';
import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';

import Waterfall, { KIND_COLORS, ROW_H } from './views/Waterfall';
import SubAgentGraph from './views/SubAgentGraph';
import ContextLifecycle from './views/ContextLifecycle';
import DecisionTree from './views/DecisionTree';
import {
  subscribeTraceAsync,
  unsubscribeTrace,
  getSpanPayloadAsync,
  selectCurrentTrace,
  selectSelectedSpan,
  selectSpanTree,
  selectSpan,
  selectTailing,
  selectIsRunning,
  selectPayload,
  setTailing,
} from './harnessTracesSlice';

function durationMs(span) {
  if (!span.end_time) return null;
  return new Date(span.end_time).getTime() - new Date(span.start_time).getTime();
}

// Row density by column width: below xxl (2xl, 1600px) drop the token/cost tags
// and render the duration bare; below xl (1200px) drop the duration too, so each
// span still fits on one line.
function nodeTitle(span, { compact, showDuration }) {
  const dur = durationMs(span);
  const tokens = span.usage && span.usage.total_tokens;
  const cost = span.cost_total;
  const running = !span.end_time;
  const error = span.status === 'error';
  const abandoned = span.status === 'abandoned';
  // small pills throughout: a tree row has to fit the waterfall's 26px band
  const tag = { flex: '0 0 auto', margin: 0, fontSize: compact ? 10 : 11, lineHeight: '16px', height: 16, padding: '0 4px' };
  return (
    <span className="harness-span-title" style={compact ? { fontSize: 12 } : null} title={span.name || span.span_kind}>
      <Badge
        color={running ? 'processing' : (KIND_COLORS[span.span_kind] || '#94a3b8')}
        status={running ? 'processing' : undefined}
      />
      <span className="harness-span-name">{span.name || span.span_kind}</span>
      {span.span_kind === 'hitl.pause' && running ? <Tag color="gold" style={tag}>waiting</Tag> : null}
      {error ? <Tag color="red" style={tag}>error</Tag> : null}
      {abandoned ? <Tag style={tag} title="no user reply within the HITL pause TTL">abandoned</Tag> : null}
      {dur == null || !showDuration ? null : compact
        ? <span className="harness-span-meta" style={dur > 5000 ? { color: '#d46b08' } : null}>{dur} ms</span>
        : <Tag style={tag} color={dur > 5000 ? 'orange' : 'default'}>{dur} ms</Tag>}
      {!compact && tokens ? <Tag style={tag}>{tokens} tok</Tag> : null}
      {!compact && cost ? <Tag style={tag}>${Number(cost).toFixed(4)}</Tag> : null}
    </span>
  );
}

function toTreeData(nodes, density) {
  return nodes.map((n) => ({
    key: n.span_id,
    title: nodeTitle(n, density),
    children: n.children && n.children.length ? toTreeData(n.children, density) : undefined,
  }));
}

// Collect the keys of every expandable (has-children) node in the tree.
function collectExpandableKeys(nodes, acc = []) {
  for (const n of nodes) {
    if (n.children && n.children.length) {
      acc.push(n.key);
      collectExpandableKeys(n.children, acc);
    }
  }
  return acc;
}

function roleColor(role) {
  return { system: '#6366f1', developer: '#6366f1', user: '#0ea5e9', assistant: '#22c55e', tool: '#f59e0b' }[role] || '#94a3b8';
}

function ContentBlock({ label, body }) {
  if (body == null) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 2 }}>{label}</div>
      <JsonField src={body} title={label} />
    </div>
  );
}

// Renders a captured message list ([{role, content}]) as role-labeled blocks.
function Messages({ messages }) {
  return (
    <div>
      {messages.map((m, i) => (
        <div key={i} style={{ marginBottom: 6, borderLeft: `3px solid ${roleColor(m.role)}`, paddingLeft: 8 }}>
          <div style={{ fontSize: 11, color: roleColor(m.role), fontWeight: 600 }}>{m.role || 'message'}{m.name ? ` (${m.name})` : ''}</div>
          <JsonField src={m.content ?? m} title={`${m.role || 'message'} content`} />
        </div>
      ))}
    </div>
  );
}

// Lazily fetches and renders a span's captured content (model/tool IO).
export function SpanContent({ span, workspaceId, traceId }) {
  const dispatch = useDispatch();
  const payload = useSelector(selectPayload(span.span_id));

  useEffect(() => {
    if (span.payload_ref && workspaceId && traceId) {
      dispatch(getSpanPayloadAsync({ workspaceId, traceId, spanId: span.span_id }));
    }
  }, [dispatch, workspaceId, traceId, span.span_id, span.payload_ref]);

  if (!span.payload_ref) return null;
  const header = <div style={{ fontWeight: 600, marginBottom: 4, marginTop: 12 }}>Content</div>;
  if (!payload || payload.loading) return <div>{header}<Spin size="small" /></div>;
  if (payload.error) return <div>{header}<span style={{ color: 'rgba(0,0,0,0.45)', fontSize: 12 }}>{payload.error}</span></div>;

  const c = payload.content || {};
  if (c._truncated) {
    return (
      <div>{header}
        <div style={{ color: '#eb6834', fontSize: 12, marginBottom: 4 }}>content truncated ({c._bytes} bytes) — showing preview</div>
        <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12, background: '#f6f6f4', borderRadius: 4, padding: '6px 8px', maxHeight: 300, overflow: 'auto' }}>{c.preview}</div>
      </div>
    );
  }
  const inputIsMessages = Array.isArray(c.input) && c.input.some(x => x && typeof x === 'object' && 'role' in x);
  const outputIsMessages = Array.isArray(c.output) && c.output.some(x => x && typeof x === 'object' && 'role' in x);
  return (
    <div>{header}
      {inputIsMessages ? <><div style={{ fontWeight: 600, fontSize: 12 }}>Input</div><Messages messages={c.input} /></> : <ContentBlock label="Input" body={c.input} />}
      {outputIsMessages ? <><div style={{ fontWeight: 600, fontSize: 12, marginTop: 8 }}>Output</div><Messages messages={c.output} /></> : <ContentBlock label="Output" body={c.output} />}
    </div>
  );
}

function SpanDetail({ span, workspaceId, traceId }) {
  if (!span) return <div style={{ color: 'rgba(0,0,0,0.45)' }}>Select a span.</div>;
  const dur = durationMs(span);
  const u = span.usage || {};
  return (
    <div>
      <Descriptions column={1} size="small" bordered>
        <Descriptions.Item label="Kind">{span.span_kind}</Descriptions.Item>
        <Descriptions.Item label="Name">{span.name}</Descriptions.Item>
        <Descriptions.Item label="Status">
          <Tag color={span.status === 'error' ? 'red' : span.status === 'ok' ? 'green' : 'default'}>{span.status}</Tag>
          {!span.end_time ? <Tag color="processing">running</Tag> : null}
        </Descriptions.Item>
        {dur != null ? <Descriptions.Item label="Duration">{dur} ms</Descriptions.Item> : null}
        {span.response_model || span.request_model ? (
          <Descriptions.Item label="Model">{span.provider ? span.provider + ' / ' : ''}{span.response_model || span.request_model}</Descriptions.Item>
        ) : null}
        {u.total_tokens != null ? (
          <Descriptions.Item label="Tokens">
            in {u.prompt_tokens || 0}{u.cached_tokens ? ` (cached ${u.cached_tokens})` : ''} · out {u.completion_tokens || 0}{u.reasoning_tokens ? ` (reasoning ${u.reasoning_tokens})` : ''} · total {u.total_tokens}
          </Descriptions.Item>
        ) : null}
        {span.cost_total != null ? <Descriptions.Item label="Cost">${Number(span.cost_total).toFixed(6)}</Descriptions.Item> : null}
        {span.status_message ? <Descriptions.Item label="Error">{span.status_message}</Descriptions.Item> : null}
      </Descriptions>
      {span.attributes && Object.keys(span.attributes).length ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Attributes</div>
          <JsonField src={span.attributes} title="Attributes" />
        </div>
      ) : null}
      {span.events && span.events.length ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Events</div>
          <JsonField src={span.events} title="Events" />
        </div>
      ) : null}
      <SpanContent span={span} workspaceId={workspaceId} traceId={traceId} />
    </div>
  );
}

// Each column is a full-height flex box whose body is the only scrolling part,
// keeping the panel's own header (tree controls, view switcher) pinned.
const PANEL = { height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 };
// Vertical scrolling only; long content wraps (see .harness-panel-body in App.css).
const PANEL_BODY = { flex: '1 1 auto', minHeight: 0, overflowY: 'auto', overflowX: 'hidden' };
// One header line per panel, all controls small, so their text sits on a common
// baseline and both panel bodies start at the same y.
const PANEL_HEADER = { flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 8, height: 24, marginBottom: 12 };
// Tree rows are sized through antd's own tokens rather than by overriding its
// (runtime-injected, so cascade-winning) CSS: titleHeight is the row height and
// treeNodePadding — derived from paddingXS — is the gap below each row. Zero the
// gap and the pitch is exactly ROW_H, matching the waterfall's per-span band.
const TREE_THEME = { components: { Tree: { titleHeight: ROW_H, paddingXS: 0 } } };

export function HarnessTraceView() {
  const dispatch = useDispatch();
  const { id: traceId } = useParams();
  const { selectedWorkspace } = useContext(WorkspaceContext);
  const { setNavbarState } = useContext(NavbarContext);

  const current = useSelector(selectCurrentTrace);
  const tree = useSelector(selectSpanTree);
  const selectedSpan = useSelector(selectSelectedSpan);
  const tailing = useSelector(selectTailing);
  const isRunning = useSelector(selectIsRunning);
  const screens = Grid.useBreakpoint();
  const density = useMemo(() => ({ compact: !screens.xxl, showDuration: !!screens.xl }), [screens.xxl, screens.xl]);
  const [centerView, setCenterView] = useState('waterfall');
  const [scale, setScale] = useState('linear');
  const [expandedKeys, setExpandedKeys] = useState([]);
  const seenKeysRef = useRef(new Set());

  const workspaceId = selectedWorkspace && selectedWorkspace.id;

  useEffect(() => {
    setNavbarState(state => ({ ...state, createLink: null, title: 'Harness Trace' }));
  }, []);

  useEffect(() => {
    if (workspaceId && traceId) {
      // seed snapshot + attach live tail; tear the stream down on unmount / change
      dispatch(subscribeTraceAsync({ workspaceId, traceId }));
    }
    return () => { dispatch(unsubscribeTrace()); };
  }, [dispatch, workspaceId, traceId]);

  const treeData = useMemo(() => toTreeData(tree, density), [tree, density]);
  const expandableKeys = useMemo(() => collectExpandableKeys(treeData), [treeData]);
  const summary = current.summary;

  // Expand newly-arrived nodes by default (mirrors the old defaultExpandAll,
  // including for live-tailed spans) without re-expanding what the user collapsed.
  useEffect(() => {
    const fresh = expandableKeys.filter((k) => !seenKeysRef.current.has(k));
    if (fresh.length) {
      fresh.forEach((k) => seenKeysRef.current.add(k));
      setExpandedKeys((prev) => Array.from(new Set([...prev, ...fresh])));
    }
  }, [expandableKeys]);

  return (
    // Fill the viewport (minus chrome) and let each of the three panels scroll on
    // its own, so a long waterfall or span tree doesn't push the others off-screen.
    <div style={{ padding: '16px 16px 0 16px', height: 'calc(100vh - 112px)', minHeight: 420, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: '0 0 auto', marginBottom: 12 }}>
        {summary && summary.awaiting_user
          ? <Tag color="gold">⏸ awaiting user</Tag>
          : isRunning ? <Tag color="processing">● LIVE</Tag>
            : summary && summary.status === 'abandoned'
              ? <Tag title="suspended on the user and never resumed; closed by the reaper">⊘ abandoned</Tag>
              : <Tag color="green">✓ done</Tag>}
        {summary && summary.session_id
          ? <Tag title={summary.session_id}>conversation: {summary.session_id}</Tag>
          : null}
        {summary ? (
          <>
            <Tag>{summary.turns} turns</Tag>
            <Tag>{summary.tool_calls} tool calls</Tag>
            <Tag>{summary.total_tokens} tokens</Tag>
            <Tag>${Number(summary.cost_total || 0).toFixed(4)}</Tag>
          </>
        ) : null}
        {isRunning && !tailing ? (
          <Button
            size="small"
            type="primary"
            icon={<VerticalAlignBottomOutlined />}
            onClick={() => dispatch(setTailing(true))}
            style={{ marginLeft: 8 }}
          >
            Jump to latest
          </Button>
        ) : null}
      </div>
      <div style={{ flex: '1 1 auto', minHeight: 0 }}>
        <Spin spinning={current.loading} wrapperClassName="harness-trace-spin">
          <Row gutter={16} style={{ height: '100%' }}>
            <Col span={7} style={PANEL}>
              <div style={PANEL_HEADER}>
                <Button size="small" onClick={() => setExpandedKeys(expandableKeys)}>Expand all</Button>
                <Button size="small" onClick={() => setExpandedKeys([])}>Collapse all</Button>
              </div>
              <div className="harness-panel-body" style={PANEL_BODY}>
                <ConfigProvider theme={TREE_THEME}>
                  <Tree
                    blockNode
                    className="harness-span-tree"
                    showLine
                    treeData={treeData}
                    expandedKeys={expandedKeys}
                    onExpand={(keys) => setExpandedKeys(keys)}
                    selectedKeys={current.selectedSpanId ? [current.selectedSpanId] : []}
                    onSelect={(keys) => { if (keys[0]) dispatch(selectSpan(keys[0])); }}
                  />
                </ConfigProvider>
              </div>
            </Col>
            <Col span={10} style={PANEL}>
              <div style={PANEL_HEADER}>
                <Segmented
                  size="small"
                  value={centerView}
                  onChange={setCenterView}
                  options={[
                    { label: 'Waterfall', value: 'waterfall' },
                    { label: 'Context', value: 'context' },
                    { label: 'Decisions', value: 'decisions' },
                    { label: 'Sub-agents', value: 'graph' },
                    { label: 'Raw', value: 'raw' },
                  ]}
                />
                {/* the scale switch shares the view switch's line, and is dropped
                    below xl where there isn't room for both */}
                {centerView === 'waterfall' && screens.xl ? (
                  <Segmented
                    size="small"
                    value={scale}
                    onChange={setScale}
                    options={[{ label: 'Linear', value: 'linear' }, { label: 'Log', value: 'log' }]}
                    style={{ marginLeft: 'auto' }}
                  />
                ) : null}
              </div>
              <div className="harness-panel-body" style={PANEL_BODY}>
                {centerView === 'waterfall' ? <Waterfall scale={scale} expandedKeys={expandedKeys} /> : null}
                {centerView === 'context' ? <ContextLifecycle /> : null}
                {centerView === 'decisions' ? <DecisionTree /> : null}
                {centerView === 'graph' ? <SubAgentGraph /> : null}
                {centerView === 'raw' ? <JsonView src={Object.values(current.spans)} collapsed={2} /> : null}
              </div>
            </Col>
            <Col span={7} style={PANEL}>
              <div className="harness-panel-body" style={PANEL_BODY}>
                <SpanDetail span={selectedSpan} workspaceId={workspaceId} traceId={traceId} />
              </div>
            </Col>
          </Row>
        </Spin>
      </div>
    </div>
  );
}
