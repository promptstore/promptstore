import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Button, Form, Input, Layout, Modal, Select, Space, Switch, Table, Typography } from 'antd';

import { JsonView } from '../../components/JsonView';
import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';

import {
  getFunctionsAsync,
  selectLoading as selectFunctionsLoading,
  selectFunctions,
} from '../functions/functionsSlice';
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
import {
  createAgentAsync,
  deleteAgentsAsync,
  getAgentsAsync,
  resetAgentOutput,
  runAgentAsync,
  selectAgents,
  selectAgentOutput,
  selectLoaded,
  selectLoading,
  selectRunning,
  updateAgentAsync,
} from './agentsSlice';
import {
  getToolsAsync,
  selectTools,
} from './toolsSlice';

const { Content, Sider } = Layout;
const { TextArea } = Input;

const agentTypeOptions = [
  {
    label: 'Plan & Execute',
    value: 'plan',
  },
  {
    label: 'OpenAI Assistant',
    value: 'openai',
    disabled: true,
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

  const [isOutputModalOpen, setOutputModalOpen] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedAgentId, setSelectedAgentId] = useState(null);
  const [isDirty, setIsDirty] = useState(false);

  const agents = useSelector(selectAgents);
  const agentOutput = useSelector(selectAgentOutput);
  const functions = useSelector(selectFunctions);
  const functionsLoading = useSelector(selectFunctionsLoading);
  const indexes = useSelector(selectIndexes);
  const indexesLoading = useSelector(selectIndexesLoading);
  const loaded = useSelector(selectLoaded);
  const loading = useSelector(selectLoading);
  const models = useSelector(selectModels);
  const modelsLoading = useSelector(selectModelsLoading);
  const running = useSelector(selectRunning);
  const tools = useSelector(selectTools);

  const functionOptions = useMemo(() => {
    const list = Object.values(functions).map((f) => ({
      label: f.name,
      value: f.id,
    }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [functions]);

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
    list.push({
      label: 'Semantic Function',
      value: 'semanticFunction',
    });
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [tools]);

  const [form] = Form.useForm();
  const toolsValue = Form.useWatch('allowedTools', form);

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();

  // console.log('agents:', agents);

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
      dispatch(getFunctionsAsync({ workspaceId }));
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

  const onCloseModal = () => {
    setOutputModalOpen(false);
  }

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
    setOutputModalOpen(true);
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
      <Modal
        cancelText="Close"
        onCancel={onCloseModal}
        onOk={onCloseModal}
        okButtonProps={{ style: { display: 'none' } }}
        open={isOutputModalOpen}
        width={'75%'}
        height={'75%'}
        title="Agent Output"
        wrapClassName="agent-output"
      >
        {agentOutput.length ?
          <div style={{
            backgroundColor: '#fff',
            border: '1px solid rgba(0, 0, 0, .15)',
            boxSizing: 'border-box',
            color: 'rgba(0, 0, 0, 0.88)',
            fontSize: '14px',
            height: 'calc(100% - 50px)',
            lineHeight: '22px',
            overflowY: 'scroll',
            padding: '4px 11px',
          }}>
            {agentOutput.map((o) => (
              <Output label={o.key} text={o.output} />
            ))}
          </div>
          : null
        }
      </Modal>
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
                style={{ display: 'inline-block', width: 'calc(25% - 8px)' }}
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
                style={{ display: 'inline-block', width: 'calc(75% - 8px)', marginLeft: 16 }}
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
                  style={{ display: 'inline-block', width: 'calc(25% - 8px)', marginRight: 16 }}
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
              {toolsValue?.includes('semanticFunction') ?
                <Form.Item
                  label="Function"
                  name="functionId"
                  style={{ display: 'inline-block', width: 'calc(25% - 8px)' }}
                  wrapperCol={{ span: 24 }}
                >
                  <Select
                    allowClear
                    loading={functionsLoading}
                    options={functionOptions}
                    optionFilterProp="label"
                  />
                </Form.Item>
                : null
              }
              <div>
                <Form.Item
                  label="Model"
                  name="modelId"
                  style={{ display: 'inline-block', width: 'calc(25% - 8px)' }}
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
              <div style={{ margin: '16px 0' }}>
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
            {/* <div style={{ marginTop: 20 }}>
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
                      <Output label={o.key} text={o.output} />
                    ))}
                  </div>
                </>
                : null
              }
            </div> */}
          </Content>
          <Sider
            style={{ backgroundColor: 'inherit', marginLeft: 20 }}
            width={350}
          >
            {/* <Typography.Paragraph>
              Agents are a work in progress. Current tool selection is small.
            </Typography.Paragraph>
            <Typography.Paragraph>
              Roadmap items include tools for document retrieval and nudges via email and Microsoft Teams.
            </Typography.Paragraph> */}
          </Sider>
        </Layout>
      </div >
    </>
  );
}

function Output({ label, text }) {
  let x;
  x = extractJsonObject(text);
  if (!x) {
    x = extractJsonArray(text);
  }
  const img = extractImageUrl(text);
  let imgEl;
  if (img) {
    imgEl = (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
        <img src={img[0]} style={{ height: 156, width: 156 }} />
      </div>
    );
  }
  if (x) {
    return (
      <div key={label}>
        <Text label={label + '-0'} text={text.substring(0, x[1])} />
        <JsonView src={x[0]} />
        <Text label={label + '-1'} text={text.substring(x[2])} />
        {imgEl}
      </div>
    );
  }
  return (
    <div key={label}>
      <Text label={label} text={text} />
      {imgEl}
    </div>
  )
}

function Text({ label, text }) {
  return text.split('\n').map((line, i) => (
    <Typography.Paragraph key={label + '-' + i}>
      {line.startsWith('Step') || line.startsWith('Agent Response') || line.startsWith('Plan') || line.startsWith('Goal') ?
        <span style={{ fontWeight: 600 }}>{line}</span>
        :
        line
      }
    </Typography.Paragraph>
  ));
}

function extractImageUrl(str) {
  const imgR = /https?:\/\/.*\/.*\.(png|gif|webp|jpeg|jpg)(\?[^\s)"]*)/gmi;
  const match = imgR.exec(str);
  if (match) {
    const open = str.indexOf(match[0]);
    return [match[0], open, open + match[0].length];
  }
  return null;
}

function extractJsonObject(str) {
  let open, close, candidate;
  open = str.indexOf('{');
  do {
    close = str.lastIndexOf('}');
    if (close <= open) {
      return null;
    }
    do {
      candidate = str.substring(open, close + 1);
      try {
        const json = JSON.parse(candidate);
        return [json, open, close + 1];
      } catch (err) {
        console.log(err);
        console.log('Failed candidate:', candidate);
        // keep trying
      }
      close = str.substring(open, close).lastIndexOf('}');
    } while (close > open);
    open = str.indexOf('{', open + 1);
  } while (open !== -1);
  return null;
}

function extractJsonArray(str) {
  let open, close, candidate;
  open = str.indexOf('[');
  do {
    close = str.lastIndexOf(']');
    if (close <= open) {
      return null;
    }
    do {
      candidate = str.substring(open, close + 1);
      try {
        const json = JSON.parse(candidate);
        return [json, open, close + 1];
      } catch (err) {
        // keep trying
      }
      close = str.substring(open, close).lastIndexOf(']');
    } while (close > open);
    open = str.indexOf(';', open + 1);
  } while (open !== -1);
  return null;
}