import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Form, Input, Layout, Menu, Modal, Segmented, Select, Space } from 'antd';
import {
  ApartmentOutlined,
  ApiOutlined,
  AppstoreOutlined,
  BarcodeOutlined,
  BranchesOutlined,
  BugOutlined,
  ClockCircleOutlined,
  ContainerOutlined,
  ExperimentOutlined,
  ExportOutlined,
  FileExcelOutlined,
  FolderOutlined,
  FunctionOutlined,
  GoogleOutlined,
  HddOutlined,
  MailOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  NodeExpandOutlined,
  RedoOutlined,
  RobotOutlined,
  SearchOutlined,
  ShareAltOutlined,
  SketchOutlined,
  SwapOutlined,
  ToolOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import ReactFlow, {
  addEdge,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useStoreApi,
} from 'reactflow';
import { v4 as uuidv4 } from 'uuid';
import SchemaForm from '@rjsf/antd';
import validator from '@rjsf/validator-ajv8';
import isEmpty from 'lodash.isempty';

import { JsonView } from '../../components/JsonView';
import { SchemaModalInput } from '../../components/SchemaModalInput';
import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import { ConfluenceLogo } from '../../logos/ConfluenceLogo';
import { GCSLogo } from '../../logos/GCSLogo';
import { GoogleDriveLogo } from '../../logos/GoogleDriveLogo';
import { MinIOLogo } from '../../logos/MinIOLogo';
import { NotionLogo } from '../../logos/NotionLogo';
import { S3Logo } from '../../logos/S3Logo';
import {
  getToolsAsync,
  selectLoading as selectToolsLoading,
  selectTools,
} from '../agents/toolsSlice';
import {
  getFunctionsAsync,
  selectLoading as selectFunctionsLoading,
  selectFunctions,
} from '../functions/functionsSlice';
import {
  createCompositionAsync,
  getCompositionAsync,
  runTestAsync,
  selectCompositions,
  selectLoaded,
  selectTestResult,
  selectTestResultLoaded,
  selectTestResultLoading,
  setTestResult,
  updateCompositionAsync,
} from './compositionsSlice';

import AgentNode from './AgentNode';
import CompositionNode from './CompositionNode';
import DataSourceNode from './DataSourceNode';
import EmbeddingNode from './EmbeddingNode';
import ExtractorNode from './ExtractorNode';
import FunctionNode from './FunctionNode';
import FunctionRouterNode from './FunctionRouterNode';
import GraphStoreNode from './GraphStoreNode';
import IndexNode from './IndexNode';
import JoinerNode from './JoinerNode';
import LoaderNode from './LoaderNode';
import LoopNode from './LoopNode';
import MapperNode from './MapperNode';
import OutputNode from './OutputNode';
import RequestNode from './RequestNode';
import ScheduleNode from './ScheduleNode';
import ToolNode from './ToolNode';
import TransformerNode from './TransformerNode';
import VectorStoreNode from './VectorStoreNode';

import 'reactflow/dist/style.css';

const { TextArea } = Input;
const { Content, Sider } = Layout;

const MIN_DISTANCE = 100;

const NODE_HEIGHT = 175;
const NODE_WIDTH = 225;
const OVERLAP_OFFSET = 20;

const layout = {
  labelCol: { span: 4 },
  wrapperCol: { span: 16 },
};

const minimapStyle = {
  height: 120,
};

const nodeTypes = {
  agentNode: AgentNode,
  compositionNode: CompositionNode,
  embeddingNode: EmbeddingNode,
  extractorNode: ExtractorNode,
  functionNode: FunctionNode,
  functionRouterNode: FunctionRouterNode,
  graphStoreNode: GraphStoreNode,
  indexNode: IndexNode,
  joinerNode: JoinerNode,
  loaderNode: LoaderNode,
  loopNode: LoopNode,
  mapperNode: MapperNode,
  outputNode: OutputNode,
  requestNode: RequestNode,
  scheduleNode: ScheduleNode,
  sourceNode: DataSourceNode,
  toolNode: ToolNode,
  transformerNode: TransformerNode,
  vectorStoreNode: VectorStoreNode,
};

const proOptions = { hideAttribution: true };

const validConnections = {
  agentNode: ['agentNode', 'compositionNode', 'functionNode', 'functionRouterNode', 'joinerNode', 'loopNode', 'mapperNode', 'requestNode', 'toolNode'],
  compositionNode: ['agentNode', 'compositionNode', 'functionNode', 'joinerNode', 'loopNode', 'mapperNode', 'requestNode', 'toolNode'],
  functionNode: ['compositionNode', 'functionNode', 'joinerNode', 'loopNode', 'mapperNode', 'requestNode', 'toolNode'],
  functionRouterNode: ['agentNode', 'functionNode'],
  indexNode: ['extractorNode', 'sourceNode', 'transformerNode'],
  joinerNode: ['agentNode', 'compositionNode', 'functionNode', 'joinerNode', 'mapperNode', 'requestNode', 'toolNode'],
  loopNode: ['compositionNode', 'functionNode', 'joinerNode', 'mapperNode', 'requestNode', 'toolNode'],
  mapperNode: ['compositionNode', 'functionNode', 'joinerNode', 'loopNode', 'mapperNode', 'requestNode', 'toolNode'],
  outputNode: ['agentNode', 'compositionNode', 'functionNode', 'functionRouterNode', 'indexNode', 'joinerNode', 'mapperNode', 'toolNode', 'vectorStoreNode', 'graphStoreNode'],
  requestNode: [],
  scheduleNode: [],
  sourceNode: ['scheduleNode'],
  toolNode: ['compositionNode', 'functionNode', 'functionRouterNode', 'joinerNode', 'loopNode', 'mapperNode', 'requestNode', 'toolNode'],
  loaderNode: ['scheduleNode', 'requestNode'],
  extractorNode: ['loaderNode', 'scheduleNode', 'requestNode'],
  transformerNode: ['extractorNode', 'loaderNode'],
  embeddingNode: ['extractorNode'],
  vectorStoreNode: ['embeddingNode', 'extractorNode', 'transformerNode'],
  graphStoreNode: ['extractorNode', 'transformerNode'],
};

export function Composer() {

  const [collapsed, setCollapsed] = useState(false);
  const [formData, setFormData] = useState(null);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);

  const store = useStoreApi();

  const overlapOffsetRef = useRef(0);

  const compositions = useSelector(selectCompositions);
  const functions = useSelector(selectFunctions);
  const functionsLoading = useSelector(selectFunctionsLoading);
  const loaded = useSelector(selectLoaded);
  const testResult = useSelector(selectTestResult);
  const testResultLoaded = useSelector(selectTestResultLoaded);
  const testResultLoading = useSelector(selectTestResultLoading);
  const tools = useSelector(selectTools);
  const toolsLoading = useSelector(selectToolsLoading);

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const [form] = Form.useForm();
  const typeValue = Form.useWatch('type', form);

  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const id = location.pathname.match(/\/compositions\/(.*)/)[1];
  const composition = compositions[id];
  const isNew = id === 'new';

  // console.log('composition:', composition);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [rfInstance, setRfInstance] = useState(null);

  const onInit = (reactFlowInstance) => {
    // console.log('flow loaded:', reactFlowInstance);
    setRfInstance(reactFlowInstance);
  };

  const onConnect = useCallback((params) => {
    // console.log('params:', params);
    return setEdges((eds) => addEdge(params, eds));
  }, []);

  const { project, setViewport } = useReactFlow();

  const reactFlowWrapper = useRef(null);
  const connectingNodeId = useRef(null);

  const functionOptions = useMemo(() => {
    const list = Object.values(functions).map((f) => ({
      label: f.name,
      value: f.id,
    }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [functions]);

  const toolOptions = useMemo(() => {
    const list = tools.map((t) => ({
      label: t.name,
      value: t.key,
    }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [tools]);

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: null,
      title: 'Composition',
    }));
    dispatch(getToolsAsync());
    if (!isNew) {
      dispatch(getCompositionAsync(id));
    } else {
      form.setFieldValue('type', 'flow');
    }
  }, []);

  useEffect(() => {
    if (selectedWorkspace) {
      const workspaceId = selectedWorkspace.id;
      dispatch(getFunctionsAsync({ workspaceId }));
    }
  }, [selectedWorkspace]);

  useEffect(() => {
    if (composition && composition.flow) {
      const flow = composition.flow;
      const { x = 0, y = 0, zoom = 1 } = flow.viewport;
      let nodes = flow.nodes || [];
      const scheduleNode = nodes.find(nd => nd.type === 'scheduleNode');
      if (scheduleNode) {
        const newScheduleNode = {
          ...scheduleNode,
          data: {
            ...scheduleNode.data,
            compositionId: composition.id,
            scheduleId: composition.scheduleId,
            scheduleStatus: composition.scheduleStatus,
          },
        };
        nodes = [
          ...nodes.filter(nd => nd.type !== 'scheduleNode'),
          newScheduleNode
        ];
      }
      setNodes(nodes);
      setEdges(flow.edges || []);
      setTimeout(() => {
        setViewport({ x, y, zoom });
      }, 400);
    }
  }, [composition]);

  const onCancel = () => {
    navigate('/compositions');
  };

  const onFinish = (values) => {
    // console.log('values:', values, rfInstance.toObject());
    let flow;
    if (typeValue === 'flow') {
      flow = rfInstance.toObject();
    }
    if (isNew) {
      dispatch(createCompositionAsync({
        values: {
          ...values,
          flow,
          returnType: 'application/json',
          workspaceId: selectedWorkspace.id,
        },
      }));
    } else {
      dispatch(updateCompositionAsync({
        id,
        values: {
          ...composition,
          ...values,
          flow,
          returnType: 'application/json',
        },
      }));
    }
    // navigate('/compositions');
  };

  const getId = () => uuidv4();

  const fitViewOptions = {
    padding: 3,
  };

  // const onConnectStart = useCallback((_, { nodeId }) => {
  //   connectingNodeId.current = nodeId;
  // }, []);

  // const onConnectEnd = useCallback(
  //   (event) => {
  //     const targetIsPane = event.target.classList.contains('react-flow__pane');

  //     if (targetIsPane) {
  //       // we need to remove the wrapper bounds, in order to get the correct position
  //       const { top, left } = reactFlowWrapper.current.getBoundingClientRect();
  //       const id = getId();
  //       const newNode = {
  //         id,
  //         // we are removing the half of the node width (75) to center the new node
  //         position: project({ x: event.clientX - left - 75, y: event.clientY - top }),
  //         data: { label: `Node ${id}` },
  //       };

  //       setNodes((nds) => nds.concat(newNode));
  //       setEdges((eds) => eds.concat({ id, source: connectingNodeId.current, target: id }));
  //     }
  //   },
  //   [project]
  // );

  const getNewPosition = () => {
    const {
      height,
      width,
      transform: [transformX, transformY, zoomLevel],
    } = store.getState();
    const zoomMultiplier = 1 / zoomLevel;
    const centerX = -transformX * zoomMultiplier + (width * zoomMultiplier) / 2;
    const centerY = -transformY * zoomMultiplier + (height * zoomMultiplier) / 2;
    const nodeWidthOffset = NODE_WIDTH / 2;
    const nodeHeightOffset = NODE_HEIGHT / 2;
    const position = {
      x: centerX - nodeWidthOffset + overlapOffsetRef.current,
      y: centerY - nodeHeightOffset + overlapOffsetRef.current,
    };
    overlapOffsetRef.current += OVERLAP_OFFSET;
    return position;
  }

  const addAgentNode = () => {
    const id = getId();
    const newNode = {
      id,
      type: 'agentNode',
      data: {},
      position: getNewPosition(),
      zIndex: 1001,
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const addCompositionNode = () => {
    const id = getId();
    const newNode = {
      id,
      type: 'compositionNode',
      data: {
        parentCompositionId: composition?.id,
      },
      position: getNewPosition(),
      zIndex: 1001,
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const addDataSourceNode = () => {
    const id = getId();
    const newNode = {
      id,
      type: 'sourceNode',
      data: {},
      position: getNewPosition(),
      zIndex: 1001,
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const addEmbeddingNode = (embeddingProvider) => {
    const id = getId();
    const newNode = {
      id,
      type: 'embeddingNode',
      data: {
        embeddingProvider,
      },
      position: getNewPosition(),
      zIndex: 1001,
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const addExtractorNode = (extractor) => {
    const id = getId();
    const newNode = {
      id,
      type: 'extractorNode',
      data: {
        extractor,
      },
      position: getNewPosition(),
      zIndex: 1001,
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const addFunctionNode = () => {
    const id = getId();
    const newNode = {
      id,
      type: 'functionNode',
      data: {},
      position: getNewPosition(),
      zIndex: 1001,
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const addFunctionRouterNode = () => {
    const id = getId();
    const newNode = {
      id,
      type: 'functionRouterNode',
      data: {},
      position: getNewPosition(),
      zIndex: 1001,
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const addGraphStoreNode = (graphStoreProvider) => {
    const id = getId();
    const newNode = {
      id,
      type: 'graphStoreNode',
      data: {
        graphStoreProvider,
      },
      position: getNewPosition(),
      zIndex: 1001,
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const addIndexNode = () => {
    const id = getId();
    const newNode = {
      id,
      type: 'indexNode',
      data: {},
      position: getNewPosition(),
      zIndex: 1001,
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const addJoinerNode = () => {
    const id = getId();
    const newNode = {
      id,
      type: 'joinerNode',
      data: {},
      position: getNewPosition(),
      zIndex: 1001,
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const addLoaderNode = (loader) => {
    const id = getId();
    const newNode = {
      id,
      type: 'loaderNode',
      data: {
        loader,
      },
      position: getNewPosition(),
      zIndex: 1001,
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const addLoopNode = () => {
    const id = getId();
    const newNode = {
      id,
      type: 'loopNode',
      data: {},
      position: getNewPosition(),
      zIndex: 1001,
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const addMapperNode = () => {
    const id = getId();
    const newNode = {
      id,
      type: 'mapperNode',
      data: {},
      position: getNewPosition(),
      zIndex: 1001,
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const addOutputNode = () => {
    const id = getId();
    const newNode = {
      id,
      type: 'outputNode',
      data: {},
      position: getNewPosition(),
      zIndex: 1001,
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const addRequestNode = () => {
    const id = getId();
    const newNode = {
      id,
      type: 'requestNode',
      data: {
        label: 'Request',
      },
      position: getNewPosition(),
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const addScheduleNode = () => {
    const id = getId();
    const newNode = {
      id,
      type: 'scheduleNode',
      data: {},
      position: getNewPosition(),
      zIndex: 1001,
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const addToolNode = () => {
    const id = getId();
    const newNode = {
      id,
      type: 'toolNode',
      data: {},
      position: getNewPosition(),
      zIndex: 1001,
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const addTransformerNode = () => {
    const id = getId();
    const newNode = {
      id,
      type: 'transformerNode',
      data: {},
      position: getNewPosition(),
      zIndex: 1001,
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const addVectorStoreNode = (vectorStoreProvider) => {
    const id = getId();
    const newNode = {
      id,
      type: 'vectorStoreNode',
      data: {
        vectorStoreProvider,
      },
      position: getNewPosition(),
      zIndex: 1001,
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const getClosestEdge = useCallback((node) => {
    const { nodeInternals } = store.getState();
    const storeNodes = Array.from(nodeInternals.values());

    const closestNode = storeNodes.reduce(
      (res, n) => {
        if (n.id !== node.id) {
          const dx = n.positionAbsolute.x - node.positionAbsolute.x;
          const dy = n.positionAbsolute.y - node.positionAbsolute.y;
          const d = Math.sqrt(dx * dx + dy * dy);

          if (d < res.distance && d < MIN_DISTANCE) {
            res.distance = d;
            res.node = n;
          }
        }

        return res;
      },
      {
        distance: Number.MAX_VALUE,
        node: null,
      }
    );

    if (!closestNode.node) {
      return null;
    }

    const closeNodeIsSource = closestNode.node.positionAbsolute.x < node.positionAbsolute.x;

    return {
      // id: `${node.id}-${closestNode.node.id}`,
      id: uuidv4(),
      source: closeNodeIsSource ? closestNode.node.id : node.id,
      target: closeNodeIsSource ? node.id : closestNode.node.id,
    };
  }, []);

  const onNodeDrag = useCallback(
    (_, node) => {
      const closeEdge = getClosestEdge(node);

      setEdges((es) => {
        const nextEdges = es.filter((e) => e.className !== 'temp');

        if (
          closeEdge &&
          !nextEdges.find((ne) => ne.source === closeEdge.source && ne.target === closeEdge.target)
        ) {
          closeEdge.className = 'temp';
          nextEdges.push(closeEdge);
        }

        return nextEdges;
      });
    },
    [getClosestEdge, setEdges]
  );

  const onNodeDragStop = useCallback(
    (_, node) => {
      const closeEdge = getClosestEdge(node);

      setEdges((es) => {
        const nextEdges = es.filter((e) => e.className !== 'temp');

        if (closeEdge) {
          nextEdges.push(closeEdge);
        }

        return nextEdges;
      });
    },
    [getClosestEdge]
  );

  const runTest = async ({ formData }) => {
    dispatch(runTestAsync({
      args: formData,
      name: composition.name,
      workspaceId: selectedWorkspace.id,
    }));
  };

  const handleClose = () => {
    setIsTestModalOpen(false);
    setTimeout(() => {
      setFormData(null);
      dispatch(setTestResult({ result: null }));
    }, 200);
  };

  const uiSchema = {
    "ui:submitButtonOptions": {
      "props": {
        "loading": testResultLoading,
        "type": "primary",
      },
      "submitText": "Run",
    },
  };

  const handleTest = () => {
    setIsTestModalOpen(true);
  };

  const toggleCollapsed = () => {
    setCollapsed(!collapsed);
  };

  const args = composition?.flow?.nodes.find((n) => n.type === 'requestNode')?.data?.arguments;
  const hasDataSource = nodes.find(nd => nd.type === 'sourceNode');

  // console.log('composition:', composition);

  if (!(isNew || loaded)) {
    return (
      <div style={{ marginTop: 20 }}>Loading...</div>
    );
  }
  return (
    <>
      {true || !isNew && (!isEmpty(args) || hasDataSource) ?
        <Modal
          onCancel={handleClose}
          onOk={handleClose}
          open={isTestModalOpen}
          title={'Test ' + composition?.name}
          cancelText="Close"
          width={800}
          styles={{
            body: {
              maxHeight: 600,
              overflowY: 'auto',
            },
          }}
          okButtonProps={{ style: { display: 'none' } }}
        >
          {!isEmpty(args) ?
            <div>
              <div style={{ display: 'flex', flexDirection: 'row-reverse' }}>
                <Button type="default"
                  disabled={isEmpty(formData)}
                  onClick={() => { setFormData(null); }}
                >
                  Clear Inputs
                </Button>
              </div>
              <SchemaForm
                schema={args}
                uiSchema={uiSchema}
                validator={validator}
                formData={formData}
                onChange={(ev) => setFormData(ev.formData)}
                onSubmit={runTest}
              />
            </div>
            :
            <Button type="primary"
              loading={testResultLoading}
              onClick={() => runTest({ formData: {} })}
              style={{ marginTop: 24 }}
            >
              Run
            </Button>
          }
          {!isEmpty(testResult) && testResultLoaded ?
            <div style={{ marginBottom: 20, marginTop: 16, width: 720 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Result:</div>
              {composition.returnType === 'application/json' ?
                <JsonView src={testResult} />
                :
                <div>{String(testResult.content)}</div>
              }
            </div>
            : null
          }
        </Modal>
        : null
      }
      <Layout style={{ height: '100%' }}>
        <Sider
          style={{ background: 'transparent', height: '100%', marginRight: 20 }}
          width={collapsed || typeValue === 'codegen' ? 53 : 250}
          theme="light"
        >
          {typeValue === 'flow' ?
            <div id="composition-menu"
              className={collapsed ? 'collapsed' : ''}
              style={{ height: 'calc(100vh - 320px)', marginTop: 132 }}
            >
              <Button type="primary"
                onClick={toggleCollapsed}
                style={{ marginBottom: 24 }}
              >
                {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              </Button>
              <Menu
                disabledOverflow={true}
                mode="vertical"
                style={{
                  background: '#fff',
                  height: '100%',
                  overflowY: 'scroll',
                }}
                triggerSubMenuAction="click"
                items={[
                  {
                    key: 'agent-flow',
                    label: collapsed ? '' : 'Agent Flow',
                    type: 'group',
                    children: [
                      {
                        key: 'request',
                        label: 'Request',
                        icon: <ApiOutlined />,
                        onClick: addRequestNode,
                        title: 'Add Request Node',
                      },
                      {
                        key: 'semantic-function',
                        label: 'Semantic Function',
                        icon: <FunctionOutlined />,
                        onClick: addFunctionNode,
                        title: 'Add Semantic Function Node',
                      },
                      {
                        key: 'composition',
                        label: 'Sub-composition',
                        icon: <ApartmentOutlined />,
                        onClick: addCompositionNode,
                        title: 'Add Sub-composition Node',
                      },
                      {
                        key: 'agent',
                        label: 'Agent',
                        icon: <RobotOutlined />,
                        onClick: addAgentNode,
                        title: 'Add Agent Node',
                      },
                      {
                        key: 'function-router',
                        label: 'Function Router',
                        icon: <NodeExpandOutlined />,
                        onClick: addFunctionRouterNode,
                        title: 'Add Function Router Node',
                      },
                      {
                        key: 'tool',
                        label: 'Tool',
                        icon: <ToolOutlined />,
                        onClick: addToolNode,
                        title: 'Add Tool Node',
                      },
                      {
                        key: 'loop',
                        label: 'Loop',
                        icon: <RedoOutlined />,
                        onClick: addLoopNode,
                        title: 'Add Loop Node',
                      },
                      {
                        key: 'mapper',
                        label: 'Map',
                        icon: <SwapOutlined />,
                        onClick: addMapperNode,
                        title: 'Add Mapper Node',
                      },
                      {
                        key: 'join',
                        label: 'Join',
                        icon: <BranchesOutlined />,
                        onClick: addJoinerNode,
                        title: 'Add Join Node',
                      },
                      {
                        key: 'test',
                        label: 'Test',
                        icon: <ExperimentOutlined />,
                        // disabled: isNew || (isEmpty(args) && !hasDataSource),
                        onClick: handleTest,
                        title: 'Test',
                      },
                    ],
                  },
                  {
                    type: 'divider',
                  },
                  {
                    key: 'pipeline',
                    label: collapsed ? '' : 'RAG Pipeline',
                    type: 'group',
                    children: [
                      {
                        key: 'schedule',
                        label: 'Schedule',
                        icon: <ClockCircleOutlined />,
                        onClick: addScheduleNode,
                        title: 'Add Schedule Node',
                      },
                      {
                        key: 'data-source',
                        label: 'Data Source',
                        icon: <FolderOutlined />,
                        onClick: addDataSourceNode,
                        title: 'Add Data Source Node',
                      },
                      {
                        key: 'semantic-index',
                        label: 'Semantic Index',
                        icon: <AppstoreOutlined />,
                        onClick: addIndexNode,
                        title: 'Add Semantic Index Node',
                      },
                      {
                        key: 'loader',
                        label: 'Loader',
                        icon: <UploadOutlined />,
                        children: [
                          {
                            key: 'api',
                            label: 'API',
                            icon: <ApiOutlined />,
                            onClick: () => addLoaderNode('api'),
                            title: 'Add API Loader Node',
                          },
                          {
                            key: 'confluence',
                            label: 'Confluence',
                            icon: (
                              <span className="anticon ant-menu-item-icon">
                                <ConfluenceLogo grayscale width="14px" height="14px" />
                              </span>
                            ),
                            onClick: () => addLoaderNode('confluence'),
                            title: 'Add Confluence Loader Node',
                          },
                          {
                            key: 'notion',
                            label: 'Notion',
                            icon: (
                              <span className="anticon ant-menu-item-icon">
                                <NotionLogo grayscale width="14px" height="14px" />
                              </span>
                            ),
                            onClick: () => addLoaderNode('notion'),
                            title: 'Add Notion Loader Node',
                          },
                          {
                            key: 'gmail',
                            label: 'Gmail',
                            icon: <MailOutlined />,
                            onClick: () => addLoaderNode('gmail'),
                            title: 'Add Gmail Loader Node',
                          },
                          {
                            key: 'googledrive',
                            label: 'Google Drive',
                            icon: (
                              <span className="anticon ant-menu-item-icon">
                                <GoogleDriveLogo grayscale width="14px" height="14px" />
                              </span>
                            ),
                            onClick: () => addLoaderNode('googledrive'),
                            title: 'Add Google Drive Loader Node',
                          },
                          {
                            key: 'gcs',
                            label: 'Google Cloud Storage',
                            icon: (
                              <span className="anticon ant-menu-item-icon"
                                style={{ marginLeft: -2, marginRight: -2, verticalAlign: 'sub' }}
                              >
                                <GCSLogo grayscale width="18px" height="18px" />
                              </span>
                            ),
                            onClick: () => addLoaderNode('gcs'),
                            title: 'Add GCS Loader Node',
                          },
                          {
                            key: 's3',
                            label: 'AWS S3',
                            icon: (
                              <span className="anticon ant-menu-item-icon"
                                style={{ marginLeft: -2, marginRight: -2, verticalAlign: 'sub' }}
                              >
                                <S3Logo grayscale width="18px" height="18px" />
                              </span>
                            ),
                            onClick: () => addLoaderNode('s3'),
                            title: 'Add S3 Loader Node',
                          },
                          {
                            key: 'minio',
                            label: 'MinIO Object Store',
                            icon: (
                              <span className="anticon ant-menu-item-icon"
                                style={{ marginLeft: -2, marginRight: -2, verticalAlign: 'sub' }}
                              >
                                <MinIOLogo grayscale width="18px" height="18px" />
                              </span>
                            ),
                            onClick: () => addLoaderNode('minio'),
                            title: 'Add MinIO Loader Node',
                          },
                          {
                            key: 'neo4j',
                            label: 'Neo4j',
                            icon: <ShareAltOutlined />,
                            onClick: () => addLoaderNode('neo4j'),
                            title: 'Add Neo4j Loader Node',
                          },
                          {
                            key: 'crawler',
                            label: 'Web Crawler',
                            icon: <BugOutlined />,
                            onClick: () => addLoaderNode('crawler'),
                            title: 'Add Crawler Loader Node',
                          },
                          {
                            key: 'googlesearch',
                            label: 'Google Search',
                            icon: <GoogleOutlined />,
                            onClick: () => addLoaderNode('googlesearch'),
                            title: 'Add Google Search Loader Node',
                          },
                          {
                            key: 'wikipedia',
                            label: 'Wikipedia',
                            icon: <span className="character-icon">W</span>,
                            onClick: () => addLoaderNode('wikipedia'),
                            title: 'Add Wikipedia Loader Node',
                          },
                        ]
                      },
                      {
                        key: 'extractor',
                        label: 'Extractor',
                        icon: <ContainerOutlined />,
                        children: [
                          {
                            key: 'csv',
                            label: 'CSV',
                            icon: <FileExcelOutlined />,
                            onClick: () => addExtractorNode('csv'),
                            title: 'Add CSV Extractor Node',
                          },
                          {
                            key: 'json',
                            label: 'JSON',
                            icon: <div className="character-icon">{'{}'}</div>,
                            onClick: () => addExtractorNode('json'),
                            title: 'Add JSON Extractor Node',
                          },
                          {
                            key: 'onesource',
                            label: 'Onesource',
                            icon: <div className="character-icon">O</div>,
                            onClick: () => addExtractorNode('onesource'),
                            title: 'Add Onesource Loader Node',
                          },
                          {
                            key: 'text',
                            label: 'Text',
                            icon: <div className="character-icon">T</div>,
                            onClick: () => addExtractorNode('text'),
                            title: 'Add Text Loader Node',
                          },
                          {
                            key: 'unstructured',
                            label: 'Unstructured',
                            icon: <div className="character-icon">U</div>,
                            onClick: () => addExtractorNode('unstructured'),
                            title: 'Add Unstructured Loader Node',
                          },
                        ]
                      },
                      {
                        key: 'transformer',
                        label: 'Transformer',
                        icon: <SketchOutlined />,
                        onClick: addTransformerNode,
                        title: 'Add Transformer Node',
                      },
                      {
                        key: 'embedding',
                        label: 'Embedding',
                        icon: <BarcodeOutlined />,
                        onClick: () => addEmbeddingNode(),
                        title: 'Add Embedding Node',
                      },
                      {
                        key: 'vector-store',
                        label: 'Vector Store',
                        icon: <HddOutlined />,
                        children: [
                          {
                            key: 'chroma',
                            label: 'Chroma',
                            icon: <div className="character-icon">C</div>,
                            onClick: () => addVectorStoreNode('chroma'),
                            title: 'Add Chroma Vector Store Node',
                          },
                          {
                            key: 'neo4j',
                            label: 'Neo4j',
                            icon: <ShareAltOutlined />,
                            onClick: () => addVectorStoreNode('neo4j'),
                            title: 'Add Neo4j Vector Store Node',
                          },
                          {
                            key: 'redis',
                            label: 'Redis',
                            icon: <div className="character-icon">R</div>,
                            onClick: () => addVectorStoreNode('redis'),
                            title: 'Add Redis Vector Store Node',
                          },
                        ]
                      },
                      {
                        key: 'search-index',
                        label: 'Search Index',
                        icon: <SearchOutlined />,
                        children: [
                          {
                            key: 'elasticsearch',
                            label: 'Elasticsearch',
                            icon: <div className="character-icon">E</div>,
                            onClick: () => addVectorStoreNode('elasticsearch'),
                            title: 'Add Elasticsearch Search Index Node',
                          },
                        ]
                      },
                      {
                        key: 'graph-store',
                        label: 'Graph Store',
                        icon: <ShareAltOutlined />,
                        children: [
                          {
                            key: 'neo4j',
                            label: 'Neo4j',
                            icon: <ShareAltOutlined />,
                            onClick: () => addGraphStoreNode('neo4j'),
                            title: 'Add Neo4j Graph Store Node',
                          },
                        ]
                      },
                    ],
                  },
                  {
                    type: 'divider',
                  },
                  {
                    key: 'common',
                    label: collapsed ? '' : 'Common',
                    type: 'group',
                    children: [
                      {
                        key: 'output',
                        label: 'Output',
                        icon: <ExportOutlined />,
                        onClick: addOutputNode,
                        title: 'Add Output Node',
                      },
                    ],
                  },
                ]}
              />
            </div>
            : null
          }
        </Sider>
        <Content>
          <div style={{ marginTop: 20 }}>
            <Form
              {...layout}
              form={form}
              name="composition"
              autoComplete="off"
              onFinish={onFinish}
              initialValues={composition}
            >
              <Form.Item
                label="Name"
                name="name"
                rules={[
                  {
                    required: true,
                    message: 'Please enter a composition name',
                  },
                ]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                label="Description"
                name="description"
              >
                <TextArea autoSize={{ minRows: 1, maxRows: 14 }} />
              </Form.Item>
              <Form.Item
                label="Type"
                name="type"
              >
                <Segmented
                  options={[
                    {
                      label: 'Flow',
                      value: 'flow',
                    },
                    {
                      label: 'Codegen',
                      value: 'codegen',
                    },
                  ]}
                />
              </Form.Item>
              {typeValue === 'codegen' ?
                <>
                  <Form.Item
                    label="Request"
                    name="requestSchema"
                  >
                    <SchemaModalInput />
                  </Form.Item>
                  <Form.Item
                    label="Returns"
                    name="returnSchema"
                  >
                    <SchemaModalInput />
                  </Form.Item>
                  <Form.Item
                    label="Tools"
                    name="tools"
                  >
                    <Select
                      allowClear
                      loading={toolsLoading}
                      mode="multiple"
                      options={toolOptions}
                      optionFilterProp="label"
                    />
                  </Form.Item>
                  <Form.Item
                    label="Functions"
                    name="functions"
                  >
                    <Select
                      allowClear
                      loading={functionsLoading}
                      mode="multiple"
                      options={functionOptions}
                      optionFilterProp="label"
                    />
                  </Form.Item>
                  <Form.Item
                    label="Description"
                    name="description"
                  >
                    <TextArea
                      autoSize={{ minRows: 4, maxRows: 14 }}
                    />

                  </Form.Item>
                </>
                : null
              }
              <Form.Item wrapperCol={{ ...layout.wrapperCol, offset: 4 }}>
                <Space>
                  <Button type="default" onClick={onCancel}>Cancel</Button>
                  <Button type="primary" htmlType="submit">Save</Button>
                </Space>
              </Form.Item>
            </Form>
          </div>
          {typeValue === 'flow' ?
            <div className="wrapper" ref={reactFlowWrapper}>
              <ReactFlow
                attributionPosition="top-right"
                defaultViewport={{ x: 0, y: 0, zoom: 1.5 }}
                // fitView
                fitViewOptions={fitViewOptions}
                isValidConnection={({ source, target }) => {
                  const sourceNode = nodes.find(nd => nd.id === source);
                  const targetNode = nodes.find(nd => nd.id === target);
                  return validConnections[targetNode.type].includes(sourceNode.type);
                }}
                nodeTypes={nodeTypes}
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                // onConnectStart={onConnectStart}
                // onConnectEnd={onConnectEnd}
                // onNodeDrag={onNodeDrag}
                // onNodeDragStop={onNodeDragStop}
                onInit={onInit}
                proOptions={proOptions}
                snapToGrid
              >
                <MiniMap style={minimapStyle} zoomable pannable />
                <Controls />
                <Background color="#aaa" gap={16} />
              </ReactFlow>
            </div>
            : null
          }
        </Content>
      </Layout>
    </>
  );
}

export const initialNodes = [
  // {
  //   id: '1',
  //   type: 'requestNode',
  //   data: {
  //     label: 'Request',
  //   },
  //   position: { x: 15, y: 150 },
  // },
];

export const initialEdges = [];
