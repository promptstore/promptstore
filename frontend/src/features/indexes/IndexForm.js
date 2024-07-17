import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Button,
  Descriptions,
  Drawer,
  Form,
  Input,
  Layout,
  Popconfirm,
  Select,
  Space,
  Table,
} from 'antd';
import { CloseOutlined, PlusOutlined } from '@ant-design/icons';
import ReactFlow, { addEdge, useNodesState, useEdgesState, MarkerType } from 'reactflow';
import { GraphCanvas } from 'reagraph';
import { v4 as uuidv4 } from 'uuid';
import lowerCase from 'lodash.lowercase';

import JsonInput from '../../components/JsonInput';
import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import { SearchModal } from '../../components/SearchModal';
import {
  getModelsAsync,
  selectModels,
  selectLoaded as selectModelsLoaded,
  selectLoading as selectModelsLoading,
} from '../models/modelsSlice';
import {
  getEmbeddingProvidersAsync,
  selectEmbeddingProviders,
  selectLoading as selectEmbeddingProvidersLoading,
} from '../uploader/embeddingSlice';
import {
  getGraphStoresAsync,
  selectGraphStores,
  selectLoading as selectGraphStoresLoading,
} from '../uploader/graphStoresSlice';
import {
  getVectorStoresAsync,
  selectVectorStores,
  selectLoading as selectVectorStoresLoading,
} from '../uploader/vectorStoresSlice';

import {
  getGraphAsync,
  selectGraphs,
  selectLoaded as selectGraphsLoaded,
} from './graphsSlice';
import {
  createIndexAsync,
  createPhysicalIndexAsync,
  dropDataAsync,
  dropGraphDataAsync,
  dropPhysicalIndexAsync,
  getIndexAsync,
  updateIndexAsync,
  selectLoaded,
  selectLoading,
  selectIndexes,
} from './indexesSlice';
import CustomNode from './CustomNode';
import FloatingEdge from './FloatingEdge';
import CustomConnectionLine from './CustomConnectionLine';

import 'reactflow/dist/style.css';
import './style.css';

const { TextArea } = Input;
const { Content, Sider } = Layout;

const layout = {
  labelCol: { span: 5 },
  wrapperCol: { span: 19 },
};

const subFieldLayout = {
  colon: false,
  labelCol: { span: 24 },
  wrapperCol: { span: 24 },
};

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

export function IndexForm() {

  const [backOnSave, setBackOnSave] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [schemaDrawerOpen, setSchemaDrawerOpen] = useState(false);
  const [error, setError] = useState(null);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedSchemaEdge, setSelectedSchemaEdge] = useState(null);
  const [selectedSchemaNode, setSelectedSchemaNode] = useState(null);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const embeddingProviders = useSelector(selectEmbeddingProviders);
  const embeddingProvidersLoading = useSelector(selectEmbeddingProvidersLoading);
  const graphs = useSelector(selectGraphs);
  const graphsLoaded = useSelector(selectGraphsLoaded);
  const loaded = useSelector(selectLoaded);
  const loading = useSelector(selectLoading);
  const indexes = useSelector(selectIndexes);
  const graphStoresLoading = useSelector(selectGraphStoresLoading);
  const graphStores = useSelector(selectGraphStores);
  const models = useSelector(selectModels);
  const modelsLoaded = useSelector(selectModelsLoaded);
  const modelsLoading = useSelector(selectModelsLoading);
  const vectorStoresLoading = useSelector(selectVectorStoresLoading);
  const vectorStores = useSelector(selectVectorStores);

  const { isDarkMode, setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const [form] = Form.useForm();
  const [nodeForm] = Form.useForm();
  const vectorStoreProviderValue = Form.useWatch('vectorStoreProvider', form);
  const graphStoreProviderValue = Form.useWatch('graphStoreProvider', form);

  const id = location.pathname.match(/\/indexes\/(.*)/)[1];
  const index = indexes[id];
  const isNew = id === 'new';

  const graph = useMemo(() => {
    if (graphsLoaded) {
      const g = graphs[index.name];
      if (g) {
        const nodes = g.nodes.map(({ id, properties }) => ({
          id: String(id),
          label: properties.name,
        }));
        const edges = g.relationships.map(({ id, type, source, target }) => ({
          id: uuidv4(),
          label: type,
          source: String(source.id),
          target: String(target.id),
        }));
        return { nodes, edges };
      }
    }
    return null;
  }, [graphsLoaded]);

  const selectedNode = useMemo(() => {
    if (selectedNodeId) {
      const g = graphs[index.name];
      if (g) {
        const node = g.nodes.find(nd => nd.id == selectedNodeId);
        if (node) {
          const properties = Object.entries(node.properties || {}).filter(([key, _]) => key !== 'id');
          properties.sort((a, b) => a[0] < b[0] ? -1 : 1);
          const nodeAsSourceEdges = [];
          const nodeAsTargetEdges = [];
          for (const rel of g.relationships) {
            if (rel.source.id === node.id) {
              nodeAsSourceEdges.push(({
                type: rel.type,
                id: rel.target.id,
                target: rel.target.type,
                name: g.nodes.find(nd => nd.id == rel.target.id)?.properties.name,
              }));
            }
            if (rel.target.id === node.id) {
              nodeAsTargetEdges.push({
                type: rel.type,
                id: rel.source.id,
                source: rel.source.type,
                name: g.nodes.find(nd => nd.id == rel.source.id)?.properties.name,
              });
            }
          }
          return {
            id: node.id,
            type: node.type,
            properties,
            nodeAsSourceEdges,
            nodeAsTargetEdges,
          };
        }
      }
    }
    return null;
  }, [selectedNodeId]);

  // console.log('graphs:', graphs);
  // console.log('index:', index);
  // console.log('selectedNode:', selectedNode);

  const embeddingModelOptions = useMemo(() => {
    const list = Object.values(models)
      .filter(m => m.type === 'embedding')
      .map(m => ({
        label: m.name,
        value: m.key,
      }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [models]);

  const embeddingProviderOptions = useMemo(() => {
    const list = embeddingProviders.map(p => ({
      label: p.name,
      value: p.key,
    }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [embeddingProviders]);

  const graphStoreOptions = useMemo(() => {
    const list = graphStores.map(p => ({
      label: p.name,
      value: p.key,
    }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [graphStores]);

  const vectorStoreOptions = useMemo(() => {
    const list = vectorStores.map(p => ({
      label: p.name,
      value: p.key,
    }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [vectorStores]);

  useEffect(() => {
    if (isNew) {
      setNavbarState((state) => ({
        ...state,
        createLink: null,
        title: 'Graph or Index',
      }));
    } else {
      dispatch(getIndexAsync(id));
    }
    // dispatch(getEmbeddingProvidersAsync());
    dispatch(getVectorStoresAsync());
    dispatch(getGraphStoresAsync());
  }, []);

  useEffect(() => {
    if (!modelsLoaded) {
      dispatch(getModelsAsync({ workspaceId: selectedWorkspace.id, type: 'embedding' }));
    }
  }, [selectedWorkspace]);

  useEffect(() => {
    if (backOnSave) {
      setBackOnSave(false);
      navigate(index?.graphStoreProvider ? '/graphs' : '/indexes');
    }
  }, [indexes]);

  useEffect(() => {
    if (loaded && index) {
      setNodes(index.ontology?.nodes || []);
      setEdges(index.ontology?.edges || []);
      setNavbarState((state) => ({
        ...state,
        createLink: null,
        title: index.vectorStoreProvider ? 'Index' : 'Knowledge Graph',
      }));
    }
  }, [loaded])

  useEffect(() => {
    if (drawerOpen && !graphsLoaded) {
      dispatch(getGraphAsync({
        graphStoreProvider: index.graphStoreProvider,
        indexName: index.name,
      }));
    }
  }, [drawerOpen]);

  const addNode = () => {
    setNodes(cur => [...cur, {
      id: uuidv4(),
      type: 'custom',
      position: { x: 0, y: 0 },
    }]);
  };

  const onCancel = () => {
    navigate(index?.graphStoreProvider ? '/graphs' : '/indexes');
  };

  const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  const onFinish = (values) => {
    // delay save in case of JSON parse error
    setTimeout(() => {
      if (error) {
        setError(null);
        return;
      }
      if (isNew) {
        dispatch(createIndexAsync({
          values: {
            ...values,
            ontology: { nodes, edges },
            workspaceId: selectedWorkspace.id,
          },
        }));
      } else {
        dispatch(updateIndexAsync({
          id,
          values: {
            ...index,
            ...values,
            ontology: { nodes, edges },
          },
        }));
      }
      setBackOnSave(true);
    }, 200);
  };

  const handleSchemaNodeClick = (ev, node) => {
    nodeForm.resetFields();
    nodeForm.setFieldsValue(node.data);
    setSelectedSchemaNode(node);
  };

  const handleSchemaEdgeClick = (ev, edge) => {
    nodeForm.resetFields();
    nodeForm.setFieldsValue(edge.data);
    setSelectedSchemaEdge(edge);
  }

  const onSchemaFormCancel = () => {
    nodeForm.resetFields();
    setSelectedSchemaEdge(null);
    setSelectedSchemaNode(null);
  };

  const onSchemaFormFinish = (values) => {
    if (selectedSchemaEdge) {
      const newEdge = {
        ...selectedSchemaEdge,
        data: {
          ...selectedSchemaEdge.data,
          ...values,
        }
      };
      const index = edges.findIndex(e => e.id === selectedSchemaEdge.id);
      const newEdges = [...edges];
      newEdges.splice(index, 1, newEdge);
      setEdges(newEdges);
    } else {
      const newNode = {
        ...selectedSchemaNode,
        data: {
          ...selectedSchemaNode.data,
          ...values,
        }
      };
      const index = nodes.findIndex(nd => nd.id === selectedSchemaNode.id);
      const newNodes = [...nodes];
      newNodes.splice(index, 1, newNode);
      setNodes(newNodes);
    }
    nodeForm.resetFields();
    setSelectedSchemaEdge(null);
    setSelectedSchemaNode(null);
  };

  const store = index?.store;

  const createPhysicalIndex = () => {
    let params;
    if (index.vectorStoreProvider === 'redis' || index.vectorStoreProvider === 'elasticsearch') {
      params = {
        nodeLabel: index.nodeLabel,
      };
    } else {
      params = {
        nodeLabel: index.nodeLabel,
        embeddingProvider: index.embeddingProvider,
        embeddingModel: index.embeddingModel,
      };
    }
    dispatch(createPhysicalIndexAsync({
      id: index.id,
      name: index.name,
      schema: index.schema,
      vectorStoreProvider: index.vectorStoreProvider,
      params,
    }));
  };

  const dropData = () => {
    if (index?.vectorStoreProvider) {
      dispatch(dropDataAsync({
        id: index.id,
        name: index.name,
        nodeLabel: index.nodeLabel,
        vectorStoreProvider: index.vectorStoreProvider,
      }));
    } else if (index?.graphStoreProvider) {
      dispatch(dropGraphDataAsync({
        graphStoreProvider: index.graphStoreProvider,
        indexName: index.name,
      }));
    }
  };

  const dropPhysicalIndex = () => {
    dispatch(dropPhysicalIndexAsync({
      id: index.id,
      name: index.name,
      vectorStoreProvider: index.vectorStoreProvider,
    }));
  };

  const onSearchCancel = () => {
    setIsSearchModalOpen(false);
  };

  const openSearch = () => {
    setIsSearchModalOpen(true);
  };

  let indexParams;
  if (index) {
    indexParams = {
      nodeLabel: index.nodeLabel,
      embeddingProvider: index.embeddingProvider,
      embeddingModel: index.embeddingModel,
      vectorStoreProvider: index.vectorStoreProvider,
    };
  }

  // console.log('index:', index);

  function RedisStoreInfo({ store }) {

    const columns = [
      {
        title: 'Name',
        dataIndex: 'attribute',
      },
      {
        title: 'Type',
        dataIndex: 'type',
      },
      {
        title: 'Weight',
        dataIndex: 'weight',
      },
    ];

    const data = useMemo(() => {
      if (!store) return [];
      const list = store.attributes.map((a) => ({
        key: a.identifier,
        attribute: a.attribute,
        type: a.type,
        weight: a.WEIGHT,
      }));
      list.sort((a, b) => a.attribute > b.attribute ? 1 : -1);
      return list;
    }, [store]);

    return (
      <>
        <Form.Item wrapperCol={{ offset: 4 }} style={{ margin: 0 }}>
          <Descriptions title="Physical Index Info">
            <Descriptions.Item label="Number of documents">{store.numDocs}</Descriptions.Item>
            <Descriptions.Item label="Number of records">{store.numRecords}</Descriptions.Item>
            <Descriptions.Item label="Number of terms">{store.numTerms}</Descriptions.Item>
            <Descriptions.Item label="Average number of records per document">{getInt(store.recordsPerDocAvg)}</Descriptions.Item>
          </Descriptions>
        </Form.Item>
        <Form.Item wrapperCol={{ offset: 4, span: 12 }}>
          <Descriptions layout="vertical">
            <Descriptions.Item label="Attributes">
              <Table columns={columns} dataSource={data} pagination={false} size="small" loading={loading} style={{ minWidth: 500 }} />
            </Descriptions.Item>
          </Descriptions>
        </Form.Item>
      </>
    );
  }

  const handleNodeClick = (node) => {
    setSelectedNodeId(node.id);
  };

  function ElasticsearchStoreInfo({ store }) {

    const columns = [
      {
        title: 'Name',
        dataIndex: 'attribute',
      },
      {
        title: 'Type',
        dataIndex: 'type',
      },
    ];

    const data = useMemo(() => {
      if (!store) return [];
      const list = store.attributes.map((a) => ({
        key: a.attribute,
        attribute: a.attribute,
        type: a.type,
      }));
      list.sort((a, b) => a.attribute > b.attribute ? 1 : -1);
      return list;
    }, [store]);

    return (
      <>
        <Form.Item wrapperCol={{ offset: 4 }} style={{ margin: 0 }}>
          <Descriptions title="Physical Index Info">
            <Descriptions.Item label="Number of documents">{store.numDocs}</Descriptions.Item>
          </Descriptions>
        </Form.Item>
        <Form.Item wrapperCol={{ offset: 4, span: 12 }}>
          <Descriptions layout="vertical">
            <Descriptions.Item label="Attributes">
              <Table columns={columns} dataSource={data} pagination={false} size="small" loading={loading} style={{ minWidth: 500 }} />
            </Descriptions.Item>
          </Descriptions>
        </Form.Item>
      </>
    );
  }

  function Neo4jStoreInfo({ store }) {

    return (
      <Form.Item wrapperCol={{ offset: 4 }} style={{ margin: 0 }}>
        <Descriptions title="Physical Index Info" column={2}>
          <Descriptions.Item label="Embedding dimension">{store.embeddingDimension}</Descriptions.Item>
          <Descriptions.Item label="Similarity metric">{store.similarityMetric}</Descriptions.Item>
          <Descriptions.Item label="Node label">{store.nodeLabel}</Descriptions.Item>
          <Descriptions.Item label="Number of documents">{store.numDocs}</Descriptions.Item>
        </Descriptions>
      </Form.Item>
    );
  }

  function ChromaStoreInfo({ store }) {

    return (
      <Form.Item wrapperCol={{ offset: 4 }} style={{ margin: 0 }}>
        <Descriptions title="Physical Index Info" column={2}>
          <Descriptions.Item label="Embedding dimension">{store.embeddingDimension}</Descriptions.Item>
          <Descriptions.Item label="Similarity metric">{store.similarityMetric}</Descriptions.Item>
          <Descriptions.Item label="Node label">{store.nodeLabel}</Descriptions.Item>
          <Descriptions.Item label="Number of documents">{store.numDocs}</Descriptions.Item>
        </Descriptions>
      </Form.Item>
    );
  }

  function PhysicalStoreInfo({ store, vectorStoreProvider }) {
    if (store) {
      if (vectorStoreProvider === 'redis') {
        return (
          <RedisStoreInfo store={store} />
        );
      }
      if (vectorStoreProvider === 'neo4j') {
        return (
          <Neo4jStoreInfo store={store} />
        );
      }
      if (vectorStoreProvider === 'chroma') {
        return (
          <ChromaStoreInfo store={store} />
        );
      }
      if (vectorStoreProvider === 'elasticsearch') {
        return (
          <ElasticsearchStoreInfo store={store} />
        );
      }
    }
    return (
      <Form.Item wrapperCol={{ offset: 4 }} style={{ margin: 0 }}>
        <div>Physical index not found</div>
      </Form.Item>
    );
  }

  if (!isNew && !loaded) {
    return (
      <div style={{ marginTop: 20 }}>Loading...</div>
    );
  }
  return (
    <>
      <SearchModal
        onCancel={onSearchCancel}
        open={isSearchModalOpen}
        indexName={index?.name}
        theme={isDarkMode ? 'dark' : 'light'}
        titleField={'text'}
        indexParams={indexParams}
      />
      <div style={{ marginTop: 20 }}>
        <Form
          {...layout}
          form={form}
          name="index"
          autoComplete="off"
          onFinish={onFinish}
          initialValues={index}
        >
          <Form.Item wrapperCol={{ span: 23 }}>
            <div style={{ display: 'flex', flexDirection: 'row-reverse', gap: 16, alignItems: 'center' }}>
              {index?.graphStoreProvider ?
                <Link onClick={() => setDrawerOpen(true)}>Visualize</Link>
                : null
              }
              <Link onClick={() => setSchemaDrawerOpen(true)}>Ontology</Link>
            </div>
          </Form.Item>
          <Form.Item
            label="Name"
            name="name"
            rules={[
              {
                required: true,
                message: 'Please enter an index name',
              },
            ]}
            wrapperCol={{ span: 16 }}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Description"
            name="description"
            wrapperCol={{ span: 16 }}
          >
            <TextArea autoSize={{ minRows: 1, maxRows: 14 }} />
          </Form.Item>
          <Form.Item
            label="Vector Store"
            name="vectorStoreProvider"
            wrapperCol={{ span: 12 }}
          >
            <Select
              allowClear
              disabled={!!graphStoreProviderValue}
              loading={vectorStoresLoading}
              options={vectorStoreOptions}
              optionFilterProp="label"
            />
          </Form.Item>
          {vectorStoreProviderValue && vectorStoreProviderValue !== 'redis' && vectorStoreProviderValue !== 'elasticsearch' ?
            // <Form.Item
            //   label="Embedding"
            //   name="embeddingProvider"
            //   wrapperCol={{ span: 12 }}
            // >
            //   <Select
            //     allowClear
            //     loading={embeddingProvidersLoading}
            //     options={embeddingProviderOptions}
            //     optionFilterProp="label"
            //   />
            // </Form.Item>
            <Form.Item
              label="Embedding"
              name="embeddingModel"
              rules={[
                {
                  required: true,
                  message: 'Please select the embedding model',
                },
              ]}
              wrapperCol={{ span: 12 }}
            >
              <Select
                allowClear
                disabled={!!index?.graphStoreProvider}
                loading={modelsLoading}
                options={embeddingModelOptions}
                optionFilterProp="label"
              />
            </Form.Item>
            : null
          }
          <Form.Item
            label="Knowledge Graph"
            name="graphStoreProvider"
            wrapperCol={{ span: 12 }}
          >
            <Select
              allowClear
              disabled={!!vectorStoreProviderValue}
              loading={graphStoresLoading}
              options={graphStoreOptions}
              optionFilterProp="label"
            />
          </Form.Item>
          {index?.vectorStoreProvider ?
            <Form.Item
              label="Schema"
              name="schema"
            >
              <JsonInput
                onError={(err) => { setError(err); }}
                theme={isDarkMode ? 'dark' : 'light'}
                height={200}
              />
            </Form.Item>
            : null
          }
          <Form.Item wrapperCol={{ ...layout.wrapperCol, offset: 5 }}>
            <Space>
              <Button type="default" onClick={onCancel}>Cancel</Button>
              <Button type="primary" htmlType="submit">Save</Button>
              {index?.vectorStoreProvider ?
                <>
                  <Button type="default"
                    disabled={isNew || store}
                    onClick={createPhysicalIndex}
                  >
                    Create Physical Index
                  </Button>
                  <Popconfirm
                    title="Drop the index"
                    description="Are you sure you want to drop this index?"
                    onConfirm={dropPhysicalIndex}
                    okText="Yes"
                    cancelText="No"
                  >
                    <Button type="default"
                      disabled={isNew || !store}
                    >
                      Drop Physical Index
                    </Button>
                  </Popconfirm>
                </>
                : null
              }
              <Popconfirm
                title="Drop the data"
                description="Are you sure you want to drop the data in this index?"
                onConfirm={dropData}
                okText="Yes"
                cancelText="No"
              >
                <Button type="default"
                  disabled={isNew || (index?.vectorStoreProvider && !store)}
                >
                  Drop Data
                </Button>
              </Popconfirm>
              {index?.vectorStoreProvider ?
                <Button type="default"
                  disabled={isNew || !store}
                  onClick={openSearch}
                >
                  Search
                </Button>
                : null
              }
            </Space>
          </Form.Item>
          {index?.vectorStoreProvider ?
            <PhysicalStoreInfo vectorStoreProvider={index?.vectorStoreProvider} store={store} />
            : null
          }
        </Form>
      </div>
      <Drawer
        closable={true}
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        placement="right"
        title="Graph Network"
        width={'80%'}
      >
        <Layout style={{ width: '100%', height: '100%' }}>
          <Content>
            {graph ?
              <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                <GraphCanvas
                  {...graph}
                  onNodeClick={handleNodeClick}
                />
              </div>
              : null
            }
          </Content>
          <Sider
            open={!!selectedNode}
            theme="light"
            width={400}
          >
            {selectedNode ?
              <>
                <Descriptions bordered column={1} size="small">
                  <Descriptions.Item key={'__id'}
                    label={'id'}
                    labelStyle={{ width: 180 }}
                  >
                    {selectedNode.id}
                  </Descriptions.Item>
                  <Descriptions.Item key={'__type'}
                    label={'type'}
                    labelStyle={{ width: 180 }}
                    style={{ borderBottom: '2px solid #666' }}
                  >
                    {selectedNode.type}
                  </Descriptions.Item>
                  {selectedNode.properties.map(([key, val]) =>
                    <Descriptions.Item key={key}
                      label={lowerCase(key)}
                      labelStyle={{ width: 180 }}
                    >
                      {val}
                    </Descriptions.Item>
                  )}
                </Descriptions>
                <div style={{ fontWeight: 600, marginBottom: 5, marginTop: 16 }}>
                  Incoming relationships
                </div>
                <Descriptions bordered column={1} size="small">
                  {selectedNode.nodeAsTargetEdges?.map((rel) =>
                    Object.entries(rel).map(([key, val], i) =>
                      <Descriptions.Item key={key}
                        label={lowerCase(key)}
                        labelStyle={{ width: 180 }}
                        style={{ borderBottom: i === Object.keys(rel).length - 1 ? '2px solid #666' : 'inherit' }}
                      >
                        {val}
                      </Descriptions.Item>
                    )
                  )}
                </Descriptions>
                <div style={{ fontWeight: 600, marginBottom: 5, marginTop: 16 }}>
                  Outgoing relationships
                </div>
                <Descriptions bordered column={1} size="small">
                  {selectedNode.nodeAsSourceEdges?.map((rel) =>
                    Object.entries(rel).map(([key, val], i) =>
                      <Descriptions.Item key={key}
                        label={lowerCase(key)}
                        labelStyle={{ width: 180 }}
                        style={{ borderBottom: i === Object.keys(rel).length - 1 ? '2px solid #666' : 'inherit' }}
                      >
                        {val}
                      </Descriptions.Item>
                    )
                  )}
                </Descriptions>
              </>
              : null
            }
          </Sider>
        </Layout>
      </Drawer>
      <Drawer
        closable={true}
        onClose={() => setSchemaDrawerOpen(false)}
        open={schemaDrawerOpen}
        placement="right"

        title="Ontology Editor"
        width={'80%'}
      >
        <Layout style={{ width: '100%', height: '100%' }}>
          <Content>
            <div style={{ display: 'flex', flexDirection: 'row-reverse' }}>
              <Button className="add-btn"
                type="text"
                size="large"
                icon={<PlusOutlined />}
                onClick={addNode}
              />
            </div>
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
          </Content>
          <Sider
            theme="light"
            width={400}
            style={{ padding: '10px 15px' }}
          >
            {selectedSchemaEdge || selectedSchemaNode ?
              <Form
                autoComplete="off"
                form={nodeForm}
                layout="vertical"
                onFinish={onSchemaFormFinish}
              >
                <div
                  style={{ fontWeight: 600, marginBottom: 8 }}
                >
                  {selectedSchemaEdge ? 'Edge' : 'Node'}
                </div>
                <Form.Item
                  label="Label"
                  name="label"
                >
                  <Input />
                </Form.Item>
                <Form.Item
                  label="Description"
                  name="description"
                >
                  <TextArea autoSize={{ minRows: 1, maxRows: 14 }} />
                </Form.Item>
                <div
                  style={{ fontWeight: 600, marginBottom: 8 }}
                >
                  Properties
                </div>
                <Form.Item>
                  <Form.List name="properties">
                    {(fields, { add, remove }, { errors }) => (
                      <>
                        {fields.map((field, index) => (
                          <Form.Item key={field.name}
                          >
                            <Form.Item
                              {...subFieldLayout}
                              label={index === 0 ? 'Property' : ''}
                              name={[field.name, 'property']}
                              style={{ display: 'inline-block', width: 'calc(50% - 20px)', marginBottom: 0 }}
                            >
                              <Input />
                            </Form.Item>
                            <Form.Item
                              {...subFieldLayout}
                              label={index === 0 ? 'Data Type' : ''}
                              name={[field.name, 'dataType']}
                              style={{ display: 'inline-block', width: 'calc(50% - 20px)', marginBottom: 0, marginLeft: 8 }}
                            >
                              <Select
                                allowClear
                                options={[
                                  {
                                    label: 'Tag',
                                    value: 'tag',
                                  },
                                  {
                                    label: 'String',
                                    value: 'string',
                                  },
                                  {
                                    label: 'Number',
                                    value: 'number',
                                  },
                                  {
                                    label: 'Boolean',
                                    value: 'boolean',
                                  },
                                ]}
                              />
                            </Form.Item>
                            <Form.Item
                              {...subFieldLayout}
                              label={index === 0 ? ' ' : ''}
                              style={{ display: 'inline-block', width: '32px', marginBottom: 0 }}
                            >
                              <Button type="text"
                                icon={<CloseOutlined />}
                                className="dynamic-delete-button"
                                onClick={() => remove(field.name)}
                              />
                            </Form.Item>
                          </Form.Item>
                        ))}
                        <Form.Item
                          style={{ marginBottom: 0 }}
                        >
                          <Button
                            type="dashed"
                            onClick={() => add()}
                            style={{ width: '100%', zIndex: 101 }}
                            icon={<PlusOutlined />}
                          >
                            Add Property
                          </Button>
                          <Form.ErrorList errors={errors} />
                        </Form.Item>
                      </>
                    )}
                  </Form.List>
                </Form.Item>
                <Form.Item>
                  <div style={{ display: 'flex', flexDirection: 'row-reverse', gap: 8 }}>
                    <Button type="default" onClick={onSchemaFormCancel}>Cancel</Button>
                    <Button type="primary" htmlType="submit">Save</Button>
                  </div>
                </Form.Item>
              </Form>
              : null
            }
          </Sider>
        </Layout>
      </Drawer>
    </>
  );
}

function getInt(number) {
  if (isNaN(number)) return '';
  try {
    const int = Math.floor(number);
    return String(int);
  } catch (err) {
    console.log(err);
    return '';
  }
}