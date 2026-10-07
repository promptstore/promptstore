import { useContext, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Alert,
  Button,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Radio,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';

import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';

import {
  createMcpServerAsync,
  deleteMcpServersAsync,
  getMcpServersAsync,
  getMcpToolsAsync,
  selectLoading,
  selectMcpServers,
  selectMcpTools,
  updateMcpServerAsync,
} from './mcpServersSlice';

const TRANSPORT_OPTIONS = [
  { label: 'Streamable HTTP', value: 'http' },
  { label: 'HTTP + SSE (legacy)', value: 'sse' },
  { label: 'Local process (stdio)', value: 'stdio' },
];

const TRANSPORT_LABELS = { http: 'HTTP', sse: 'SSE', stdio: 'stdio' };

// headers/env are stored as objects but edited as key/value rows
const toPairs = (obj) => Object.entries(obj || {}).map(([key, value]) => ({ key, value }));
const fromPairs = (pairs) =>
  (pairs || []).reduce((a, { key, value }) => {
    if (key) a[key] = value ?? '';
    return a;
  }, {});

function KeyValueList({ name, keyPlaceholder, valuePlaceholder, addLabel }) {
  return (
    <Form.List name={name}>
      {(fields, { add, remove }) => (
        <>
          {fields.map(({ key, name: n, ...rest }) => (
            <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
              <Form.Item {...rest} name={[n, 'key']} noStyle>
                <Input placeholder={keyPlaceholder} style={{ width: 200 }} />
              </Form.Item>
              <Form.Item {...rest} name={[n, 'value']} noStyle>
                <Input placeholder={valuePlaceholder} style={{ width: 300 }} />
              </Form.Item>
              <MinusCircleOutlined onClick={() => remove(n)} />
            </Space>
          ))}
          <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />}>
            {addLabel}
          </Button>
        </>
      )}
    </Form.List>
  );
}

function ServerForm({ open, server, onCancel, onSave }) {
  const [form] = Form.useForm();
  const transport = Form.useWatch('transport', form);

  useEffect(() => {
    if (open) {
      form.resetFields();
      form.setFieldsValue(server ? {
        ...server,
        headers: toPairs(server.headers),
        env: toPairs(server.env),
        args: server.args || [],
      } : { transport: 'http', enabled: true, timeoutMs: 60000, headers: [], env: [], args: [] });
    }
  }, [open, server]);

  const handleOk = async () => {
    const values = await form.validateFields();
    onSave({
      ...values,
      headers: fromPairs(values.headers),
      env: fromPairs(values.env),
    });
  };

  return (
    <Modal
      open={open}
      title={server ? `Edit ${server.name}` : 'New MCP Server'}
      okText="Save"
      onOk={handleOk}
      onCancel={onCancel}
      width={720}
      destroyOnClose
    >
      <Form form={form} layout="vertical" autoComplete="off">
        <Form.Item
          label="Name"
          name="name"
          extra="Prefixes this server's tool names, e.g. github__create_issue"
          rules={[
            { required: true, message: 'Please enter a name' },
            { pattern: /^[a-zA-Z0-9_-]+$/, message: 'Letters, numbers, "_" and "-" only' },
          ]}
        >
          <Input />
        </Form.Item>
        <Form.Item label="Description" name="description">
          <Input.TextArea autoSize={{ minRows: 1, maxRows: 4 }} />
        </Form.Item>
        <Form.Item label="Transport" name="transport">
          <Radio.Group options={TRANSPORT_OPTIONS} optionType="button" />
        </Form.Item>
        {transport === 'stdio' ? (
          <>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message="stdio servers run as processes on the backend host and must be enabled with MCP_ALLOW_STDIO=true."
            />
            <Form.Item label="Command" name="command" rules={[{ required: true, message: 'Please enter a command' }]}>
              <Input placeholder="npx" />
            </Form.Item>
            <Form.Item label="Arguments" name="args">
              <Select mode="tags" tokenSeparators={[' ']} placeholder="-y @modelcontextprotocol/server-filesystem /data" />
            </Form.Item>
            <Form.Item label="Environment" extra="Values may reference secrets as {SECRET_NAME}">
              <KeyValueList name="env" keyPlaceholder="NAME" valuePlaceholder="value or {SECRET_NAME}" addLabel="Add variable" />
            </Form.Item>
          </>
        ) : (
          <>
            <Form.Item
              label="URL"
              name="url"
              rules={[{ required: true, type: 'url', message: 'Please enter a valid URL' }]}
            >
              <Input placeholder="https://example.com/mcp" />
            </Form.Item>
            <Form.Item label="Headers" extra="Values may reference secrets as {SECRET_NAME}, e.g. Bearer {GITHUB_TOKEN}">
              <KeyValueList name="headers" keyPlaceholder="Authorization" valuePlaceholder="Bearer {SECRET_NAME}" addLabel="Add header" />
            </Form.Item>
          </>
        )}
        <Space size="large">
          <Form.Item label="Timeout (ms)" name="timeoutMs">
            <InputNumber min={1000} step={1000} style={{ width: 140 }} />
          </Form.Item>
          <Form.Item label="Enabled" name="enabled" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Space>
      </Form>
    </Modal>
  );
}

function ToolsModal({ server, onClose }) {
  const dispatch = useDispatch();
  const toolsState = useSelector(selectMcpTools);
  const entry = server ? toolsState[server.id] : null;

  useEffect(() => {
    if (server) {
      dispatch(getMcpToolsAsync({ id: server.id, refresh: true }));
    }
  }, [server?.id]);

  return (
    <Modal open={!!server} title={server ? `${server.name} tools` : ''} footer={null} onCancel={onClose} width={720}>
      {entry?.error ? (
        <Alert type="error" showIcon message="Could not connect" description={entry.error} />
      ) : (
        <List
          loading={!entry || entry.loading}
          dataSource={entry?.tools || []}
          locale={{ emptyText: 'This server exposes no tools' }}
          renderItem={(tool) => (
            <List.Item>
              <List.Item.Meta
                title={
                  <Space>
                    <Typography.Text code>{tool.name}</Typography.Text>
                    {tool.annotations?.readOnlyHint ? <Tag color="green">read-only</Tag> : null}
                    {tool.annotations?.destructiveHint ? <Tag color="red">destructive</Tag> : null}
                  </Space>
                }
                description={tool.description}
              />
            </List.Item>
          )}
        />
      )}
    </Modal>
  );
}

export function McpServers() {

  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [editing, setEditing] = useState(null);  // null | 'new' | server
  const [viewing, setViewing] = useState(null);

  const loading = useSelector(selectLoading);
  const servers = useSelector(selectMcpServers);

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: null,
      title: 'MCP Servers',
    }));
  }, []);

  useEffect(() => {
    if (selectedWorkspace) {
      dispatch(getMcpServersAsync({ workspaceId: selectedWorkspace.id }));
    }
  }, [selectedWorkspace]);

  const dataSource = Object.values(servers)
    .map((s) => ({ ...s, key: s.id }))
    .sort((a, b) => (a.name < b.name ? -1 : 1));

  const handleSave = async (values) => {
    try {
      if (editing === 'new') {
        await dispatch(createMcpServerAsync({ values: { ...values, workspaceId: selectedWorkspace.id } }));
      } else {
        await dispatch(updateMcpServerAsync({ id: editing.id, values }));
      }
      setEditing(null);
    } catch (err) {
      message.error(err.response?.data?.errors?.[0]?.message || err.message);
    }
  };

  const onDelete = () => {
    dispatch(deleteMcpServersAsync({ ids: selectedRowKeys }));
    setSelectedRowKeys([]);
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      width: 220,
      render: (name, record) => (
        <Space direction="vertical" size={0}>
          <span>{name}</span>
          {record.description ? <Typography.Text type="secondary">{record.description}</Typography.Text> : null}
        </Space>
      ),
    },
    {
      title: 'Transport',
      dataIndex: 'transport',
      width: 110,
      render: (t) => <Tag>{TRANSPORT_LABELS[t] || t}</Tag>,
    },
    {
      title: 'Endpoint',
      render: (_, r) => (
        <Typography.Text code ellipsis style={{ maxWidth: 420 }}>
          {r.transport === 'stdio' ? [r.command, ...(r.args || [])].join(' ') : r.url}
        </Typography.Text>
      ),
    },
    {
      title: 'Enabled',
      dataIndex: 'enabled',
      width: 90,
      render: (enabled) => (enabled === false ? <Tag>off</Tag> : <Tag color="green">on</Tag>),
    },
    {
      title: 'Action',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space size="middle">
          <Button type="link" style={{ paddingLeft: 0 }} onClick={() => setEditing(record)}>
            Edit
          </Button>
          <Button type="link" onClick={() => setViewing(record)}>
            Test &amp; Tools
          </Button>
        </Space>
      ),
    },
  ];

  const hasSelected = selectedRowKeys.length > 0;

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button danger type="primary" onClick={onDelete} disabled={!hasSelected}>
            Delete
          </Button>
          {hasSelected ? <span>Selected {selectedRowKeys.length} items</span> : null}
        </div>
        <Button type="primary" onClick={() => setEditing('new')}>
          Add MCP Server
        </Button>
      </div>
      <Table
        rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
        columns={columns}
        dataSource={dataSource}
        loading={loading}
      />
      <ServerForm
        open={!!editing}
        server={editing === 'new' ? null : editing}
        onCancel={() => setEditing(null)}
        onSave={handleSave}
      />
      <ToolsModal server={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}
