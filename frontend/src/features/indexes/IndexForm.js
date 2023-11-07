import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Descriptions, Form, Input, Popconfirm, Select, Space, Table } from 'antd';

import JsonInput from '../../components/JsonInput';
import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import {
  getGraphStores,
  selectGraphStores,
  selectLoading as selectGraphStoresLoading,
} from '../uploader/graphStoresSlice';
import {
  getVectorStores,
  selectVectorStores,
  selectLoading as selectVectorStoresLoading,
} from '../uploader/vectorStoresSlice';

import { SearchModal } from './SearchModal';
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

const { TextArea } = Input;

const layout = {
  labelCol: { span: 4 },
  wrapperCol: { span: 20 },
};

export function IndexForm() {

  const [backOnSave, setBackOnSave] = useState(false);
  const [error, setError] = useState(null);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  const loaded = useSelector(selectLoaded);
  const loading = useSelector(selectLoading);
  const indexes = useSelector(selectIndexes);
  const graphStoresLoading = useSelector(selectGraphStoresLoading);
  const graphStores = useSelector(selectGraphStores);
  const vectorStoresLoading = useSelector(selectVectorStoresLoading);
  const vectorStores = useSelector(selectVectorStores);

  const { isDarkMode, setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const [form] = Form.useForm();

  const id = location.pathname.match(/\/indexes\/(.*)/)[1];
  const index = indexes[id] || {};
  const isNew = id === 'new';

  const vectorStoreOptions = useMemo(() => {
    const list = vectorStores.map(p => ({
      label: p.name,
      value: p.key,
    }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [vectorStores]);

  const graphStoreOptions = useMemo(() => {
    const list = graphStores.map(p => ({
      label: p.name,
      value: p.key,
    }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [graphStores]);

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: null,
      title: 'Semantic Index',
    }));
    if (!isNew) {
      dispatch(getIndexAsync(id));
    }
    dispatch(getVectorStores());
    dispatch(getGraphStores());
  }, []);

  useEffect(() => {
    if (backOnSave) {
      setBackOnSave(false);
      navigate('/indexes');
    }
  }, [indexes]);

  const onCancel = () => {
    navigate('/indexes');
  };

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
            workspaceId: selectedWorkspace.id,
          },
        }));
      } else {
        dispatch(updateIndexAsync({
          id,
          values: {
            ...index,
            ...values,
          },
        }));
      }
      setBackOnSave(true);
    }, 200);
  };

  const store = index?.store;

  const createPhysicalIndex = () => {
    let params;
    if (index.vectorStoreProvider === 'neo4j') {
      params = {
        nodeLabel: index.nodeLabel,
        embeddingProvider: index.embeddingProvider,
      };
    } else if (index.vectorStoreProvider === 'redis') {
      params = {
        nodeLabel: index.nodeLabel,
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
        <Form.Item wrapperCol={{ offset: 4 }} style={{ margin: '40px 0 0' }}>
          <Descriptions title="Physical Index Info">
            <Descriptions.Item label="Number of documents">{store.numDocs}</Descriptions.Item>
            <Descriptions.Item label="Number of records">{store.numRecords}</Descriptions.Item>
            <Descriptions.Item label="Number of terms">{store.numTerms}</Descriptions.Item>
            <Descriptions.Item label="Average number of records per document">{getInt(store.recordsPerDocAvg)}</Descriptions.Item>
          </Descriptions>
        </Form.Item>
        <Form.Item wrapperCol={{ offset: 4, span: 10 }}>
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
      <Form.Item wrapperCol={{ offset: 4 }} style={{ margin: '40px 0 0' }}>
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
    }
    return (
      <Form.Item wrapperCol={{ offset: 4 }} style={{ margin: '40px 0 0' }}>
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
        indexName={index.name}
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
          <Form.Item
            label="Name"
            name="name"
            rules={[
              {
                required: true,
                message: 'Please enter an index name',
              },
            ]}
            wrapperCol={{ span: 14 }}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Vector Store"
            name="vectorStoreProvider"
            wrapperCol={{ span: 10 }}
          >
            <Select
              allowClear
              disabled={!!index?.graphStoreProvider}
              loading={vectorStoresLoading}
              options={vectorStoreOptions}
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item
            label="Graph Store"
            name="graphStoreProvider"
            wrapperCol={{ span: 10 }}
          >
            <Select
              allowClear
              disabled={!!index?.vectorStoreProvider}
              loading={graphStoresLoading}
              options={graphStoreOptions}
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item
            label="Description"
            name="description"
            wrapperCol={{ span: 14 }}
          >
            <TextArea autoSize={{ minRows: 1, maxRows: 14 }} />
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
          <Form.Item wrapperCol={{ ...layout.wrapperCol, offset: 4 }}>
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