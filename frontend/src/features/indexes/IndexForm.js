import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Descriptions, Form, Input, Popconfirm, Select, Space, Table } from 'antd';

import JsonInput from '../../components/JsonInput';
import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';
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

  const [error, setError] = useState(null);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  const loaded = useSelector(selectLoaded);
  const loading = useSelector(selectLoading);
  const indexes = useSelector(selectIndexes);
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
  }, []);

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
      navigate('/indexes');
    }, 200);
  };

  const store = index?.store;

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

  const createPhysicalIndex = () => {
    dispatch(createPhysicalIndexAsync({
      id: index.id,
      name: index.name,
      schema: index.schema,
    }));
  };

  const dropData = () => {
    dispatch(dropDataAsync({
      name: index.name,
    }));
  };

  const dropPhysicalIndex = () => {
    dispatch(dropPhysicalIndexAsync({
      id: index.id,
      name: index.name,
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
      engine: index.engine,
      embedding: index.embedding,
      nodeLabel: index.nodeLabel,
    };
  }

  // console.log('index:', index);

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
        titleField={'__text'}
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
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Vector Store"
            name="engine"
            rules={[
              {
                required: true,
                message: 'Please select the engine',
              },
            ]}
            wrapperCol={{ span: 10 }}
          >
            <Select
              allowClear
              loading={vectorStoresLoading}
              options={vectorStoreOptions}
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item
            label="Description"
            name="description"
          >
            <TextArea autoSize={{ minRows: 1, maxRows: 14 }} />
          </Form.Item>
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
          <Form.Item wrapperCol={{ ...layout.wrapperCol, offset: 4 }}>
            <Space>
              <Button type="default" onClick={onCancel}>Cancel</Button>
              <Button type="primary" htmlType="submit">Save</Button>
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
              <Popconfirm
                title="Drop the data"
                description="Are you sure you want to drop the data in this index?"
                onConfirm={dropData}
                okText="Yes"
                cancelText="No"
              >
                <Button type="default"
                  disabled={isNew || !store}
                >
                  Drop Data
                </Button>
              </Popconfirm>
              <Button type="default"
                disabled={isNew || !store}
                onClick={openSearch}
              >
                Search
              </Button>
            </Space>
          </Form.Item>
          {store ?
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