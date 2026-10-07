import { useEffect, useMemo, useState } from 'react';
import { Divider, Form, InputNumber, Select, Space, Switch, Typography } from 'antd';

import { http } from '../../http';

const subFieldLayout = {
  colon: false,
  labelCol: { span: 24 },
  wrapperCol: { span: 24 },
};

const TOOL_GROUPS = [
  { type: 'tool', label: 'Tools' },
  { type: 'function', label: 'Semantic Functions' },
  { type: 'composition', label: 'Compositions' },
  { type: 'agent', label: 'Agents' },
  { type: 'index', label: 'Index Search' },
];

// Tool refs are stored as [{ type, key }]; the Select works on "type:key" strings.
const SEP = ':';
const toValue = (ref) => `${ref.type}${SEP}${ref.key}`;
const fromValue = (v) => {
  const i = v.indexOf(SEP);
  return { type: v.slice(0, i), key: v.slice(i + 1) };
};

const byLabel = (a, b) => (a.label < b.label ? -1 : 1);

/**
 * Loads the options for the harness tool picker. Fetched here rather than
 * through the shared slices so the function form's own state is untouched.
 */
function useToolOptions(workspaceId, functionId, indexes) {
  const [lists, setLists] = useState({ tools: [], functions: [], compositions: [], agents: [], mcp: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    setLoading(true);
    const get = (url) => http.get(url).then((res) => res.data || []).catch(() => []);
    // each enabled MCP server is connected to list its tools; an unreachable
    // server still offers "all tools", resolved when the function runs
    const getMcp = async () => {
      const servers = (await get(`/api/workspaces/${workspaceId}/mcp-servers`)).filter((s) => s.enabled !== false);
      return Promise.all(servers.map(async (server) => ({
        server,
        tools: await get(`/api/mcp-servers/${server.id}/tools`),
      })));
    };
    Promise.all([
      get('/api/tools'),
      get(`/api/workspaces/${workspaceId}/functions`),
      get(`/api/workspaces/${workspaceId}/compositions`),
      get(`/api/workspaces/${workspaceId}/agents`),
      getMcp(),
    ]).then(([tools, functions, compositions, agents, mcp]) => {
      if (cancelled) return;
      setLists({ tools, functions, compositions, agents, mcp });
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const options = useMemo(() => {
    const items = {
      tool: lists.tools.map((t) => ({ label: t.name, value: toValue({ type: 'tool', key: t.key }), title: t.description })),
      // a function cannot call itself
      function: lists.functions
        .filter((f) => String(f.id) !== String(functionId))
        .map((f) => ({ label: f.name, value: toValue({ type: 'function', key: String(f.id) }), title: f.description })),
      composition: lists.compositions.map((c) => ({ label: c.name, value: toValue({ type: 'composition', key: String(c.id) }) })),
      agent: lists.agents.map((a) => ({ label: a.name, value: toValue({ type: 'agent', key: String(a.id) }) })),
      index: Object.values(indexes || {})
        .filter((ix) => ix.vectorStoreProvider)
        .map((ix) => ({ label: ix.name, value: toValue({ type: 'index', key: ix.name }) })),
    };
    const mcpGroups = lists.mcp.map(({ server, tools }) => ({
      label: `MCP: ${server.name}`,
      options: [
        { label: `${server.name}: all tools`, value: toValue({ type: 'mcp', key: String(server.id) }) },
        ...tools
          .map((t) => ({
            label: `${server.name}: ${t.name}`,
            value: toValue({ type: 'mcp', key: `${server.id}/${t.name}` }),
            title: t.description,
          }))
          .sort(byLabel),
      ],
    }));
    return [
      ...TOOL_GROUPS
        .map((g) => ({ label: g.label, options: items[g.type].sort(byLabel) }))
        .filter((g) => g.options.length),
      ...mcpGroups,
    ];
  }, [lists, indexes, functionId]);

  return { options, loading };
}

/**
 * Agent harness settings for one implementation: when enabled, the
 * implementation runs a multi-turn tool loop instead of a single model call.
 * Stored as `implementations[n].harness`.
 */
export function HarnessSettings({ field, workspaceId, functionId, indexes }) {
  const form = Form.useFormInstance();
  const enabled = Form.useWatch(['implementations', field.name, 'harness', 'enabled'], form);
  const compactionEnabled = Form.useWatch(['implementations', field.name, 'harness', 'compaction', 'enabled'], form);
  const { options, loading } = useToolOptions(enabled ? workspaceId : null, functionId, indexes);

  const name = (...path) => [field.name, 'harness', ...path];

  return (
    <>
      <Divider orientation="left" plain style={{ height: 32, marginTop: 24 }}>
        Agent Harness
      </Divider>
      <Form.Item
        name={name('enabled')}
        valuePropName="checked"
        extra="Run a multi-turn tool loop instead of a single model call"
        style={{ marginTop: '-8px' }}
      >
        <Switch />
      </Form.Item>
      {enabled ? (
        <>
          <Form.Item
            {...subFieldLayout}
            name={name('tools')}
            label="Tools"
            getValueProps={(refs) => ({ value: (refs || []).map(toValue) })}
            normalize={(values) => (values || []).map(fromValue)}
          >
            <Select
              allowClear
              mode="multiple"
              loading={loading}
              options={options}
              optionFilterProp="label"
              placeholder="Select tools the agent may call"
            />
          </Form.Item>
          <Space wrap>
            <Form.Item {...subFieldLayout} name={name('maxTurns')} label="Max turns" initialValue={10}>
              <InputNumber min={1} max={100} style={{ width: 100 }} />
            </Form.Item>
            <Form.Item {...subFieldLayout} name={name('maxDurationMs')} label="Timeout (ms)" initialValue={300000}>
              <InputNumber min={1000} step={1000} style={{ width: 120 }} />
            </Form.Item>
            <Form.Item {...subFieldLayout} name={name('maxCostUsd')} label="Max cost ($)">
              <InputNumber min={0} step={0.1} style={{ width: 100 }} />
            </Form.Item>
          </Space>
          <Form.Item
            {...subFieldLayout}
            name={name('toolExecution')}
            label="Tool execution"
            initialValue="parallel"
          >
            <Select
              options={[
                { label: 'Parallel', value: 'parallel' },
                { label: 'Sequential', value: 'sequential' },
              ]}
              style={{ width: 160 }}
            />
          </Form.Item>
          <Form.Item
            name={name('compaction', 'enabled')}
            valuePropName="checked"
            initialValue={true}
            extra="Summarize older turns when the context window fills"
          >
            <Switch />
          </Form.Item>
          {compactionEnabled ? (
            <Space wrap>
              <Form.Item {...subFieldLayout} name={name('compaction', 'reserveTokens')} label="Reserve tokens" initialValue={16384}>
                <InputNumber min={0} step={1024} style={{ width: 120 }} />
              </Form.Item>
              <Form.Item {...subFieldLayout} name={name('compaction', 'keepRecentTokens')} label="Keep recent tokens" initialValue={20000}>
                <InputNumber min={0} step={1024} style={{ width: 120 }} />
              </Form.Item>
            </Space>
          ) : null}
          <Typography.Text type="secondary" style={{ fontSize: '0.85em' }}>
            Runs appear in Harness Traces. Pass <code>sessionId</code> to keep conversation state across calls.
          </Typography.Text>
        </>
      ) : null}
    </>
  );
}
