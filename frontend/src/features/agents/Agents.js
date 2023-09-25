import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Button, Form, Input, Layout, Select, Space, Switch, Table, Typography } from 'antd';

import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';

import {
  createAgentAsync,
  deleteAgentsAsync,
  getAgentsAsync,
  getToolsAsync,
  resetAgentOutput,
  runAgentAsync,
  selectAgents,
  selectAgentOutput,
  selectLoaded,
  selectLoading,
  selectRunning,
  selectTools,
  updateAgentAsync,
} from './agentsSlice';
import {
  getIndexesAsync,
  selectLoading as selectIndexesLoading,
  selectIndexes,
} from '../indexes/indexesSlice';
import {
  getModelsAsync,
  selectLoading as selectModelsLoading,
  selectModels,
} from '../models/modelsSlice';

const { Content, Sider } = Layout;
const { TextArea } = Input;

const agentTypeOptions = [
  {
    label: 'Plan & Execute',
    value: 'plan',
  },
  {
    label: 'ReAct Zero-shot Learning',
    value: 'react',
  },
];

const layout = {
  labelCol: { span: 24 },
  wrapperCol: { span: 24 },
};

export function Agents() {

  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedAgentId, setSelectedAgentId] = useState(null);
  const [isDirty, setIsDirty] = useState(false);

  const agents = useSelector(selectAgents);
  const loaded = useSelector(selectLoaded);
  const loading = useSelector(selectLoading);
  const agentOutput = useSelector(selectAgentOutput);
  const running = useSelector(selectRunning);
  const tools = useSelector(selectTools);
  const indexes = useSelector(selectIndexes);
  const indexesLoading = useSelector(selectIndexesLoading);
  const models = useSelector(selectModels);
  const modelsLoading = useSelector(selectModelsLoading);

  const indexOptions = useMemo(() => {
    const list = Object.values(indexes).map((t) => ({
      label: t.name,
      value: t.name,
    }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [indexes]);

  const modelOptions = useMemo(() => {
    const list = Object.values(models)
      .filter((m) => m.type === 'gpt' || m.type === 'completion')
      .map((m) => ({
        label: m.name,
        value: m.id,
      }))
      ;
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [models]);

  const toolOptions = useMemo(() => {
    const list = tools.map((t) => ({
      label: t.name,
      value: t.key,
    }));
    list.push({
      label: 'Search Index',
      value: 'searchIndex',
    });
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [tools]);

  const [form] = Form.useForm();
  const toolsValue = Form.useWatch('allowedTools', form);

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      title: 'Agents',
    }));
    dispatch(getToolsAsync());
    return () => {
      dispatch(resetAgentOutput());
    }
  }, []);

  useEffect(() => {
    if (selectedWorkspace) {
      const workspaceId = selectedWorkspace.id;
      dispatch(getIndexesAsync({ workspaceId }));
      dispatch(getModelsAsync({ workspaceId }));
      dispatch(getAgentsAsync({ workspaceId }));
    }
  }, [selectedWorkspace]);

  const columns = [
    {
      title: 'Agents',
      dataIndex: 'name',
      width: '100%',
      render: (_, { key, name }) => (
        <Link onClick={() => openAgent(key)}>{name}</Link>
      )
    },
  ];

  const data = useMemo(() => {
    const list = Object.values(agents).map((a) => ({
      key: a.id,
      name: a.name || a.id,
    }));
    list.sort((a, b) => a.name > b.name ? 1 : -1);
    return list;
  }, [agents]);

  const openAgent = (id) => {
    dispatch(resetAgentOutput());
    setSelectedAgentId(id);
    const agent = agents[id];
    form.setFieldsValue(agent);
  };

  const onCancel = () => {
    dispatch(resetAgentOutput());
    form.resetFields();
    setSelectedAgentId(null);
  };

  const onDelete = () => {
    dispatch(deleteAgentsAsync({ ids: selectedRowKeys }));
    if (selectedAgentId && selectedRowKeys.indexOf(selectedAgentId) !== -1) {
      dispatch(resetAgentOutput());
      form.resetFields();
      setSelectedAgentId(null);
    }
    setSelectedRowKeys([]);
  };

  const onFinish = (values) => {
    if (selectedAgentId) {
      const newAgent = {
        id: selectedAgentId,
        values,
      };
      dispatch(updateAgentAsync(newAgent));
    } else {
      dispatch(createAgentAsync({
        values: { ...values, workspaceId: selectedWorkspace.id },
      }));
    }
    setIsDirty(false);
  };

  const onRun = () => {
    dispatch(resetAgentOutput());
    const agent = agents[selectedAgentId];
    const model = models[agent.modelId];
    dispatch(runAgentAsync({
      agent: {
        ...agent,
        isChat: model.type === 'gpt',
        model: model.key,
        provider: model.provider,
      },
      workspaceId: selectedWorkspace.id,
    }));
  };

  const onSelectChange = (newSelectedRowKeys) => {
    setSelectedRowKeys(newSelectedRowKeys);
  };


  function LabelledSwitch({ checked, label, onChange }) {
    return (
      <>
        <Switch checked={checked} onChange={onChange} />
        <div style={{ display: 'inline-flex', alignItems: 'center', height: 32, marginLeft: 8 }}>
          {label}
        </div>
      </>
    );
  }

  function Text({ label, text }) {
    return text.split('\n').map((line, i) => (
      <div key={label + '-' + i}>{line}</div>
    ));
  }

  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
    selections: [
      Table.SELECTION_ALL,
    ],
  };

  const hasSelected = selectedRowKeys.length > 0;

  return (
    <>
      <div style={{ height: '100%', marginTop: 20 }}>
        <Layout style={{ height: '100%' }}>
          <Sider
            style={{ height: '100%', marginRight: 20 }}
            width={250}
            theme="light"
          >
            <div style={{ margin: '24px 8px 16px' }}>
              <Button danger type="primary" size="small" onClick={onDelete} disabled={!hasSelected}>
                Delete
              </Button>
              <span style={{ marginLeft: 8 }}>
                {hasSelected ? `Selected ${selectedRowKeys.length} items` : ''}
              </span>
            </div>
            <Table
              rowSelection={rowSelection}
              columns={columns}
              dataSource={data}
              loading={loading}
            />
          </Sider>
          <Content>
            <Form
              {...layout}
              form={form}
              name="model"
              autoComplete="off"
              onFinish={onFinish}
              onValuesChange={() => { setIsDirty(true); }}
            >
              <Form.Item
                label="Name"
                name="name"
                rules={[
                  {
                    required: true,
                    message: 'Please name the agent',
                  },
                ]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                label="Goal"
                name="goal"
                rules={[
                  {
                    required: true,
                    message: 'Please give the agent a goal',
                  },
                ]}
              >
                <TextArea autoSize={{ minRows: 1, maxRows: 14 }} />
              </Form.Item>
              <Form.Item
                label="Agent Type"
                name="agentType"
                rules={[
                  {
                    required: true,
                    message: 'Please select the type of agent',
                  },
                ]}
                style={{ display: 'inline-block', width: 'calc(25% - 5px)' }}
                wrapperCol={{ span: 24 }}
              >
                <Select
                  options={agentTypeOptions}
                  optionFilterProp="label"
                />
              </Form.Item>
              <Form.Item
                label="Tools"
                name="allowedTools"
                style={{ display: 'inline-block', width: 'calc(50% - 5px)', marginLeft: 8 }}
                wrapperCol={{ span: 24 }}
              >
                <Select
                  allowClear
                  mode="multiple"
                  options={toolOptions}
                  optionFilterProp="label"
                />
              </Form.Item>
              {toolsValue?.includes('searchIndex') ?
                <Form.Item
                  label="Index"
                  name="indexName"
                  style={{ display: 'inline-block', width: 'calc(25% - 6px)', marginLeft: 8 }}
                  wrapperCol={{ span: 24 }}
                >
                  <Select
                    allowClear
                    loading={indexesLoading}
                    options={indexOptions}
                    optionFilterProp="label"
                  />
                </Form.Item>
                : null
              }
              <div>
                <Form.Item
                  label="Model"
                  name="modelId"
                  style={{ display: 'inline-block', width: 'calc(25% - 5px)' }}
                  wrapperCol={{ span: 24 }}
                >
                  <Select
                    allowClear
                    loading={modelsLoading}
                    options={modelOptions}
                    optionFilterProp="label"
                  />
                </Form.Item>
              </div>
              <div>
                <Form.Item
                  name="useFunctions"
                  valuePropName="checked"
                  style={{ display: 'inline-block' }}
                  wrapperCol={{ span: 24 }}
                >
                  <LabelledSwitch label="Use Functions" />
                </Form.Item>
                <Form.Item
                  name="selfEvaluate"
                  valuePropName="checked"
                  style={{ display: 'inline-block', marginLeft: 16 }}
                  wrapperCol={{ span: 24 }}
                >
                  <LabelledSwitch label="Self Evaluate" />
                </Form.Item>
              </div>
              <Form.Item wrapperCol={{ ...layout.wrapperCol }}>
                <Space>
                  <Button type="default"
                    onClick={onCancel}
                  >
                    Cancel
                  </Button>
                  <Button type="primary" htmlType="submit">
                    {selectedAgentId ? 'Update' : 'Create'}
                  </Button>
                  <Button type="primary"
                    disabled={!selectedAgentId || isDirty}
                    loading={running}
                    onClick={onRun}
                  >
                    Run
                  </Button>
                </Space>
              </Form.Item>
            </Form>
            <div style={{ marginTop: 20 }}>
              {agentOutput.length ?
                <>
                  <div style={{
                    color: 'rgba(0, 0, 0, 0.88)',
                    fontSize: '14px',
                    height: 32,
                    marginBottom: 8,
                  }}>
                    Output
                  </div>
                  <div style={{
                    backgroundColor: '#fff',
                    border: '1px solid #d9d9d9',
                    borderRadius: '6px',
                    boxSizing: 'border-box',
                    color: 'rgba(0, 0, 0, 0.88)',
                    fontSize: '14px',
                    lineHeight: '22px',
                    padding: '4px 11px',
                  }}>
                    {agentOutput.map((o) => (
                      <Typography.Paragraph key={o.key}>
                        <Text label={o.key} text={o.output} />
                      </Typography.Paragraph>
                    ))}
                  </div>
                </>
                : null
              }
            </div>
          </Content>
          <Sider
            style={{ backgroundColor: 'inherit', marginLeft: 20 }}
            width={250}
          >
            <Typography.Paragraph>
              Agents are a work in progress. Current tool selection is small.
            </Typography.Paragraph>
            <Typography.Paragraph>
              Roadmap items include tools for document retrieval and nudges via email and Microsoft Teams.
            </Typography.Paragraph>
          </Sider>
        </Layout>
      </div >
    </>
  );
}
