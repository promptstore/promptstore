import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Form, Input, Modal, Space } from 'antd';
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
import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';
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
} from '../composer/compositionsSlice';

import CompositionNode from './CompositionNode';
import DataSourceNode from './DataSourceNode';
import FunctionNode from './FunctionNode';
import IndexNode from './IndexNode';
import JoinerNode from './JoinerNode';
import MapperNode from './MapperNode';
import OutputNode from './OutputNode';
import RequestNode from './RequestNode';
import ScheduleNode from './ScheduleNode';
import ToolNode from './ToolNode';

import 'reactflow/dist/style.css';

const MIN_DISTANCE = 100;

const NODE_HEIGHT = 175;
const NODE_WIDTH = 225;
const OVERLAP_OFFSET = 20;

const layout = {
  labelCol: { span: 4 },
  wrapperCol: { span: 20 },
};

const minimapStyle = {
  height: 120,
};

const nodeTypes = {
  compositionNode: CompositionNode,
  functionNode: FunctionNode,
  indexNode: IndexNode,
  joinerNode: JoinerNode,
  mapperNode: MapperNode,
  outputNode: OutputNode,
  requestNode: RequestNode,
  scheduleNode: ScheduleNode,
  sourceNode: DataSourceNode,
  toolNode: ToolNode,
};

const proOptions = { hideAttribution: true };

const validConnections = {
  compositionNode: ['compositionNode', 'functionNode', 'joinerNode', 'mapperNode', 'requestNode', 'toolNode'],
  functionNode: ['compositionNode', 'functionNode', 'joinerNode', 'mapperNode', 'requestNode', 'toolNode'],
  indexNode: ['sourceNode'],
  joinerNode: ['compositionNode', 'functionNode', 'joinerNode', 'mapperNode', 'requestNode', 'toolNode'],
  mapperNode: ['compositionNode', 'functionNode', 'joinerNode', 'mapperNode', 'requestNode', 'toolNode'],
  outputNode: ['compositionNode', 'functionNode', 'indexNode', 'joinerNode', 'mapperNode', 'toolNode'],
  requestNode: [],
  scheduleNode: [],
  sourceNode: ['scheduleNode'],
  toolNode: ['compositionNode', 'functionNode', 'joinerNode', 'mapperNode', 'requestNode', 'toolNode'],
};

export function Composer() {

  const [formData, setFormData] = useState(null);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);

  const store = useStoreApi();

  const overlapOffsetRef = useRef(0);

  const compositions = useSelector(selectCompositions);
  const loaded = useSelector(selectLoaded);
  const testResult = useSelector(selectTestResult);
  const testResultLoaded = useSelector(selectTestResultLoaded);
  const testResultLoading = useSelector(selectTestResultLoading);

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const [form] = Form.useForm();

  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const id = location.pathname.match(/\/compositions\/(.*)/)[1];
  const composition = compositions[id];
  const isNew = id === 'new';

  console.log('composition:', composition);

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

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: null,
      title: 'Composition',
    }));
    if (!isNew) {
      dispatch(getCompositionAsync(id));
    }
  }, []);

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
    if (isNew) {
      dispatch(createCompositionAsync({
        values: {
          ...values,
          flow: rfInstance.toObject(),
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
          flow: rfInstance.toObject(),
          returnType: 'application/json',
        },
      }));
    }
    navigate('/compositions');
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

  // console.log('composition:', composition);
  const args = composition?.flow?.nodes.find((n) => n.type === 'requestNode')?.data?.arguments;
  const hasDataSource = nodes.find(nd => nd.type === 'sourceNode');

  if (!(isNew || loaded)) {
    return (
      <div style={{ marginTop: 20 }}>Loading...</div>
    );
  }
  return (
    <>
      {!isNew && (!isEmpty(args) || hasDataSource) ?
        <Modal
          onCancel={handleClose}
          onOk={handleClose}
          open={isTestModalOpen}
          title={'Test ' + composition?.name}
          okText={'Done'}
          width={800}
          bodyStyle={{
            maxHeight: 600,
            overflowY: 'auto',
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
            <Button onClick={() => runTest({ formData: {} })}>
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
          <Form.Item wrapperCol={{ ...layout.wrapperCol, offset: 4 }}>
            <Space>
              <Button type="default" onClick={onCancel}>Cancel</Button>
              <Button type="primary" htmlType="submit">Save</Button>
            </Space>
          </Form.Item>
        </Form>
      </div>
      <Space>
        <Button onClick={addRequestNode}>
          Add Request
        </Button>
        <Button onClick={addFunctionNode}>
          Add Semantic Function
        </Button>
        <Button onClick={addCompositionNode}>
          Add Sub-composition
        </Button>
        <Button onClick={addToolNode}>
          Add Tool
        </Button>
        <Button onClick={addMapperNode}>
          Add Mapper
        </Button>
        <Button onClick={addJoinerNode}>
          Add Joiner
        </Button>
        <Button onClick={addDataSourceNode}>
          Add Data Source
        </Button>
        <Button onClick={addIndexNode}>
          Add Index
        </Button>
        <Button onClick={addScheduleNode}>
          Add Schedule
        </Button>
        <Button onClick={addOutputNode}>
          Add Output
        </Button>
        {!isNew ?
          <Button
            disabled={isEmpty(args) && !hasDataSource}
            onClick={() => { handleTest(); }}
          >
            Test
          </Button>
          : null
        }
      </Space>
      <div className="wrapper" ref={reactFlowWrapper}>
        <ReactFlow
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
          // fitView
          snapToGrid
          defaultViewport={{ x: 0, y: 0, zoom: 1.5 }}
          fitViewOptions={fitViewOptions}
          attributionPosition="top-right"
          nodeTypes={nodeTypes}
          proOptions={proOptions}
          isValidConnection={({ source, target }) => {
            const sourceNode = nodes.find(nd => nd.id === source);
            const targetNode = nodes.find(nd => nd.id === target);
            return validConnections[targetNode.type].includes(sourceNode.type);
          }}
        >
          <MiniMap style={minimapStyle} zoomable pannable />
          <Controls />
          <Background color="#aaa" gap={16} />
        </ReactFlow>
      </div>
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
