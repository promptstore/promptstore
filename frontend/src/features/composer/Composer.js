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
import ReactJson from 'react-json-view';
import isEmpty from 'lodash.isempty';

import { SchemaModalInput } from '../../components/SchemaModalInput';
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
import {
  getFunctionsAsync,
  selectFunctions,
  selectLoaded as selectFunctionsLoaded,
} from '../functions/functionsSlice';
import {
  getModelsAsync,
  selectModels,
  selectLoaded as selectModelsLoaded,
} from '../models/modelsSlice';
import {
  getPromptSetsAsync,
  selectPromptSets,
  selectLoaded as selectPromptSetsLoaded,
} from '../promptSets/promptSetsSlice';

import FunctionNode from './FunctionNode';
import JoinerNode from './JoinerNode';
import MapperNode from './MapperNode';
import OutputNode from './OutputNode';
import RequestNode from './RequestNode';

import 'reactflow/dist/style.css';

const MIN_DISTANCE = 150;

const layout = {
  labelCol: { span: 4 },
  wrapperCol: { span: 20 },
};

const minimapStyle = {
  height: 120,
};

const nodeTypes = {
  functionNode: FunctionNode,
  joinerNode: JoinerNode,
  mapperNode: MapperNode,
  outputNode: OutputNode,
  requestNode: RequestNode,
};

const proOptions = { hideAttribution: true };

export function Composer() {

  const [formData, setFormData] = useState(null);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);

  const store = useStoreApi();

  const compositions = useSelector(selectCompositions);
  const functions = useSelector(selectFunctions);
  const loaded = useSelector(selectLoaded);
  const models = useSelector(selectModels);
  const promptSets = useSelector(selectPromptSets);
  const functionsLoaded = useSelector(selectFunctionsLoaded);
  const modelsLoaded = useSelector(selectModelsLoaded);
  const promptSetsLoaded = useSelector(selectPromptSetsLoaded);
  const testResult = useSelector(selectTestResult);
  const testResultLoaded = useSelector(selectTestResultLoaded);
  const testResultLoading = useSelector(selectTestResultLoading);

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const [form] = Form.useForm();

  const functionValues = Object.values(functions);
  const modelValues = Object.values(models);
  const promptSetValues = Object.values(promptSets);

  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const id = location.pathname.match(/\/compositions\/(.*)/)[1];
  const composition = compositions[id];
  const isNew = id === 'new';

  const ready = functionsLoaded && modelsLoaded && promptSetsLoaded;

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
    if (selectedWorkspace) {
      const workspaceId = selectedWorkspace.id;
      dispatch(getModelsAsync({ workspaceId }));
      dispatch(getPromptSetsAsync({ workspaceId }));
      dispatch(getFunctionsAsync({ workspaceId }));
    }
  }, [selectedWorkspace]);

  useEffect(() => {
    if (composition && composition.flow) {
      const flow = composition.flow;
      const { x = 0, y = 0, zoom = 1 } = flow.viewport;
      setNodes(flow.nodes || []);
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

  const addFunctionNode = () => {
    const id = getId();
    const newNode = {
      id,
      type: 'functionNode',
      data: {
        functions: functionValues,
      },
      position: { x: 0, y: 0 },
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const addJoinerNode = () => {
    const id = getId();
    const newNode = {
      id,
      type: 'joinerNode',
      data: {
      },
      position: { x: 0, y: 0 },
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const addMapperNode = () => {
    const id = getId();
    const newNode = {
      id,
      type: 'mapperNode',
      data: {
        models: models,
        promptSets: promptSets,
      },
      position: { x: 0, y: 0 },
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const addOutputNode = () => {
    const id = getId();
    const newNode = {
      id,
      type: 'outputNode',
      data: {
      },
      position: { x: 0, y: 0 },
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

  if (!((isNew || loaded) && ready)) {
    return (
      <div style={{ marginTop: 20 }}>Loading...</div>
    );
  }
  return (
    <>
      {!isNew && !isEmpty(args) ?
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
        >
          <div style={{ width: 720 }}>
            <div style={{ float: 'right' }}>
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
          {!isEmpty(testResult) && testResultLoaded ?
            <div style={{ marginBottom: 20, marginTop: 16, width: 720 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Result:</div>
              {composition.returnType === 'application/json' ?
                <ReactJson src={testResult} />
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
          {/* <Form.Item
            label="Arguments"
            name="arguments"
          >
            <SchemaModalInput />
          </Form.Item> */}
          <Form.Item wrapperCol={{ ...layout.wrapperCol, offset: 4 }}>
            <Space>
              <Button type="default" onClick={onCancel}>Cancel</Button>
              <Button type="primary" htmlType="submit">Save</Button>
            </Space>
          </Form.Item>
        </Form>
      </div>
      <Space>
        <Button onClick={addFunctionNode}>
          Add Semantic Function
        </Button>
        <Button onClick={addMapperNode}>
          Add Mapper
        </Button>
        <Button onClick={addJoinerNode}>
          Add Joiner
        </Button>
        <Button onClick={addOutputNode}>
          Add Output
        </Button>
        {!isNew ?
          <Button
            disabled={isEmpty(args)}
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
  {
    id: '1',
    type: 'requestNode',
    data: {
      label: 'Request',
    },
    position: { x: 15, y: 150 },
  },
];

export const initialEdges = [
];
