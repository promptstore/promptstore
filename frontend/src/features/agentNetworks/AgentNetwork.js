import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Form, Input, Layout, Select, Space, Switch } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import ReactFlow, { addEdge, useNodesState, useEdgesState, MarkerType } from 'reactflow';
import { v4 as uuidv4 } from 'uuid';

import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import {
  getAgentsAsync,
  selectAgents,
} from '../agents/agentsSlice';

import CustomNode from './CustomNode';
import FloatingEdge from './FloatingEdge';
import CustomConnectionLine from './CustomConnectionLine';
import {
  createAgentNetworkAsync,
  getAgentNetworkAsync,
  selectAgentNetworks,
  selectLoaded,
  updateAgentNetworkAsync,
} from './agentNetworksSlice';

import 'reactflow/dist/style.css';
import './style.css';

const { TextArea } = Input;
const { Content, Sider } = Layout;

const connectionLineStyle = {
  strokeWidth: 1,
  stroke: 'black',
};

const nodeTypes = {
  custom: CustomNode,
};

const edgeTypes = {
  floating: FloatingEdge,
};

const defaultEdgeOptions = {
  style: { strokeWidth: 1, stroke: 'black' },
  type: 'floating',
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: 'black',
  },
};

export function AgentNetwork() {

  const [selectedEdge, setSelectedEdge] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);

  const agentNetworks = useSelector(selectAgentNetworks);
  const agents = useSelector(selectAgents);
  const loaded = useSelector(selectLoaded);

  const agentOptions = useMemo(() => {
    const list = Object.values(agents).map((a) => ({
      label: a.name,
      value: a.id,
    }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [agents]);

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const [form] = Form.useForm();
  const [nodeForm] = Form.useForm();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  const id = location.pathname.match(/\/agent-networks\/(.*)/)[1];
  const agentNetwork = agentNetworks[id];
  const isNew = id === 'new';

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: null,
      title: 'Agent Network',
    }));
    if (!isNew) {
      dispatch(getAgentNetworkAsync(id));
    }
  }, []);

  useEffect(() => {
    if (selectedWorkspace) {
      const workspaceId = selectedWorkspace.id;
      dispatch(getAgentsAsync({ workspaceId }));
    }
  }, [selectedWorkspace]);

  useEffect(() => {
    if (loaded && agentNetwork) {
      setNodes(agentNetwork.network?.nodes || []);
      setEdges(agentNetwork.network?.edges || []);
    }
  }, [loaded])

  const addNode = () => {
    setNodes(cur => [...cur, {
      id: uuidv4(),
      type: 'custom',
      position: { x: 0, y: 0 },
    }]);
  };

  const handleSchemaNodeClick = (ev, node) => {
    nodeForm.resetFields();
    nodeForm.setFieldsValue(node.data);
    setSelectedNode(node);
  };

  const handleSchemaEdgeClick = (ev, edge) => {
    nodeForm.resetFields();
    nodeForm.setFieldsValue(edge.data);
    setSelectedEdge(edge);
  }

  const onCancel = () => {
    navigate('/agent-networks');
  };

  const onFinish = (values) => {
    if (isNew) {
      dispatch(createAgentNetworkAsync({
        values: {
          ...values,
          network: { nodes, edges },
          workspaceId: selectedWorkspace.id,
        },
      }));
    } else {
      dispatch(updateAgentNetworkAsync({
        id,
        values: {
          ...agentNetwork,
          ...values,
          network: { nodes, edges },
        },
      }));
    }

  };

  const onFormCancel = () => {
    nodeForm.resetFields();
    setSelectedEdge(null);
    setSelectedNode(null);
  };

  const onFormFinish = (values) => {
    if (selectedEdge) {
      const newEdge = {
        ...selectedEdge,
        data: {
          ...selectedEdge.data,
          ...values,
        }
      };
      const index = edges.findIndex(e => e.id === selectedEdge.id);
      const newEdges = [...edges];
      newEdges.splice(index, 1, newEdge);
      setEdges(newEdges);
    } else {
      const agent = agents[values.agentId];
      const newNode = {
        ...selectedNode,
        data: {
          ...selectedNode.data,
          ...values,
          label: agent.name,
        }
      };
      const index = nodes.findIndex(nd => nd.id === selectedNode.id);
      const newNodes = [...nodes];
      newNodes.splice(index, 1, newNode);
      setNodes(newNodes);
    }
    nodeForm.resetFields();
    setSelectedEdge(null);
    setSelectedNode(null);
  };

  if (!isNew && !loaded) {
    return (
      <div style={{ marginTop: 20 }}>Loading...</div>
    );
  }
  return (
    <Layout style={{ height: '100%', width: '100%' }}>
      <Content>
        <Form
          form={form}
          name="agent-network"
          autoComplete="off"
          onFinish={onFinish}
          initialValues={agentNetwork}
          style={{ padding: 16 }}
        >
          <Form.Item
            label="Name"
            name="name"
            rules={[
              {
                required: true,
                message: 'Please enter a network name',
              },
            ]}
            wrapperCol={{ span: 16 }}
          >
            <Input />
          </Form.Item>
          <Form.Item
            style={{ marginBottom: 0, marginTop: 10 }}
          >
            <Space>
              <Button type="default" onClick={onCancel}>Cancel</Button>
              <Button type="primary" htmlType="submit">Save</Button>
            </Space>
          </Form.Item>
        </Form>
        <div style={{ backgroundColor: '#fff', height: 'calc(100% - 120px)' }}>
          <div style={{ display: 'flex', flexDirection: 'row-reverse' }}>
            <Button className="add-btn"
              type="text"
              size="large"
              icon={<PlusOutlined />}
              onClick={addNode}
            />
          </div>
          <div style={{ height: 'calc(100% - 60px)' }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              fitView
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              defaultEdgeOptions={defaultEdgeOptions}
              connectionLineComponent={CustomConnectionLine}
              connectionLineStyle={connectionLineStyle}
              onNodeClick={handleSchemaNodeClick}
              onEdgeClick={handleSchemaEdgeClick}
            />
          </div>
        </div>
      </Content>
      <Sider
        theme="light"
        width={400}
        style={{ backgroundColor: 'rgb(245, 245, 245)', padding: '130px 15px 10px' }}
      >
        {selectedEdge || selectedNode ?
          <Form
            autoComplete="off"
            form={nodeForm}
            layout="vertical"
            onFinish={onFormFinish}
          >
            <Form.Item
              label="Agent"
              name="agentId"
            >
              <Select
                allowClear
                options={agentOptions}
                optionFilterProp="label"
              />
            </Form.Item>
            <Form.Item
              label="Goal"
              name="goal"
            >
              <TextArea autoSize={{ minRows: 1, maxRows: 14 }} />
            </Form.Item>
            <Form.Item
              label="Starting Point"
              name="start"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Form.Item>
              <div style={{ display: 'flex', flexDirection: 'row-reverse', gap: 8 }}>
                <Button type="default" onClick={onFormCancel}>Cancel</Button>
                <Button type="primary" htmlType="submit">Save</Button>
              </div>
            </Form.Item>
          </Form>
          : null
        }
      </Sider>
    </Layout>
  );
}