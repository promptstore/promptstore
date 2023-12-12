import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Divider, Form, Input, Modal, Select, Space } from 'antd';
import { PlusOutlined } from '@ant-design/icons';

import { TagsInput } from '../../components/TagsInput';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import {
  getFunctionsByTagAsync,
  selectFunctions,
  selectLoaded as selectFunctionsLoaded,
  selectLoading as selectFunctionsLoading,
} from '../functions/functionsSlice';
import {
  getIndexesAsync,
  selectIndexes,
  selectLoaded as selectIndexesLoaded,
  selectLoading as selectIndexesLoading,
  setIndexes,
} from '../indexes/indexesSlice';

import {
  getEmbeddingProviders,
  selectEmbeddingProviders,
  selectLoaded as selectEmbeddingProvidersLoaded,
  selectLoading as selectEmbeddingProvidersLoading,
} from './embeddingSlice';
import {
  getGraphStores,
  selectGraphStores,
  selectLoaded as selectGraphStoresLoaded,
  selectLoading as selectGraphStoresLoading,
} from './graphStoresSlice';
import {
  getVectorStores,
  selectVectorStores,
  selectLoaded as selectVectorStoresLoaded,
  selectLoading as selectVectorStoresLoading,
} from './vectorStoresSlice';

const CHUNKER_TAG = 'chunker';

const layout = {
  labelCol: { span: 4 },
  wrapperCol: { span: 20 },
};

const splitterOptions = [
  {
    label: 'Delimiter',
    value: 'delimiter',
  },
  {
    label: 'Token',
    value: 'token',
  },
  {
    label: 'Chunking Function',
    value: 'chunker',
  },
];

export function IndexModal({
  ext,
  isDataSource,
  onCancel,
  onSubmit,
  open,
  type,
  width = 800,
}) {

  const [newIndex, setNewIndex] = useState('');

  const embeddingProvidersLoaded = useSelector(selectEmbeddingProvidersLoaded);
  const embeddingProvidersLoading = useSelector(selectEmbeddingProvidersLoading);
  const embeddingProviders = useSelector(selectEmbeddingProviders);
  const functions = useSelector(selectFunctions);
  const functionsLoaded = useSelector(selectFunctionsLoaded);
  const functionsLoading = useSelector(selectFunctionsLoading);
  const graphStoresLoaded = useSelector(selectGraphStoresLoaded);
  const graphStoresLoading = useSelector(selectGraphStoresLoading);
  const graphStores = useSelector(selectGraphStores);
  const indexes = useSelector(selectIndexes);
  const indexesLoaded = useSelector(selectIndexesLoaded);
  const indexesLoading = useSelector(selectIndexesLoading);
  const vectorStoresLoaded = useSelector(selectVectorStoresLoaded);
  const vectorStoresLoading = useSelector(selectVectorStoresLoading);
  const vectorStores = useSelector(selectVectorStores);

  const { selectedWorkspace } = useContext(WorkspaceContext);

  const embeddingOptions = useMemo(() => {
    const list = embeddingProviders.map(p => ({
      label: p.name,
      value: p.key,
    }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [embeddingProviders]);

  const functionOptions = useMemo(() => {
    const list = Object.values(functions)
      .filter((func) => func.tags?.includes(CHUNKER_TAG))
      .map((func) => ({
        label: func.name,
        value: func.id,
      }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [functions]);

  const indexOptions = useMemo(() => {
    const list = Object.values(indexes)
      .map((index) => ({
        label: index.name,
        value: index.id,
      }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [indexes]);

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

  const dispatch = useDispatch();

  const newIndexInputRef = useRef(null);

  const [form] = Form.useForm();
  const indexValue = Form.useWatch('indexId', form);
  const splitterValue = Form.useWatch('splitter', form);
  const vectorStoreProviderValue = Form.useWatch('vectorStoreProvider', form);
  const graphStoreProviderValue = Form.useWatch('graphStoreProvider', form);

  useEffect(() => {
    if (!indexesLoaded && open) {
      dispatch(getIndexesAsync({ workspaceId: selectedWorkspace.id }));
    }
  }, [indexesLoaded, open]);

  useEffect(() => {
    if (!functionsLoaded && splitterValue === 'chunker' && selectedWorkspace) {
      dispatch(getFunctionsByTagAsync({ tag: CHUNKER_TAG, workspace: selectedWorkspace.id }));
    }
  }, [functionsLoaded, splitterValue, selectedWorkspace]);

  useEffect(() => {
    if (indexValue === 'new') {
      if (!embeddingProvidersLoaded) {
        dispatch(getEmbeddingProviders());
      }
      if (!vectorStoresLoaded) {
        dispatch(getVectorStores());
      }
      if (!graphStoresLoaded) {
        dispatch(getGraphStores());
      }
    }
  }, [indexValue]);

  const createNewIndex = (ev) => {
    ev.preventDefault();
    if (newIndex) {
      dispatch(setIndexes({
        indexes: [{ id: 'new', name: newIndex }],
      }));
    }
    setTimeout(() => {
      newIndexInputRef.current?.focus();
    }, 0);
  };

  const handleCancel = () => {
    onCancel();
    form.resetFields();
  }

  const handleOk = async () => {
    const values = await form.validateFields();
    onSubmit({ ...values, newIndexName: newIndex });
    form.resetFields();
  };

  const onNewIndexChange = (ev) => {
    setNewIndex(ev.target.value);
  };

  if (!open) {
    return (
      <></>
    );
  }
  return (
    <Modal
      onCancel={handleCancel}
      onOk={handleOk}
      open={open}
      title="Index"
      width={width}
      bodyStyle={{ marginBottom: 24, minHeight: 200 }}
    >
      <Form
        {...layout}
        form={form}
      >
        <Form.Item
          label="Index"
          name="indexId"
          rules={[
            {
              required: true,
              message: 'Please select the index',
            },
          ]}
        >
          <Select
            loading={indexesLoading}
            options={indexOptions}
            optionFilterProp="label"
            dropdownRender={(menu) => (
              <>
                {menu}
                <Divider style={{ margin: '8px 0' }} />
                <Space style={{ padding: '0 8px 4px' }}>
                  <Input
                    placeholder="Enter new index name"
                    ref={newIndexInputRef}
                    value={newIndex}
                    onChange={onNewIndexChange}
                  />
                  <Button type="text" icon={<PlusOutlined />} onClick={createNewIndex}>
                    Create New Index
                  </Button>
                </Space>
              </>
            )}
          />
        </Form.Item>
        {indexValue === 'new' ?
          <>
            <Form.Item
              label="Vector Store"
              name="vectorStoreProvider"
              wrapperCol={{ span: 10 }}
            >
              <Select
                allowClear
                disabled={!!graphStoreProviderValue}
                loading={vectorStoresLoading}
                options={vectorStoreOptions}
                optionFilterProp="label"
              />
            </Form.Item>
            {vectorStoreProviderValue && vectorStoreProviderValue !== 'redis' ?
              <Form.Item
                label="Embedding"
                name="embeddingProvider"
                rules={[
                  {
                    required: true,
                    message: 'Please select the embedding provider',
                  },
                ]}
                wrapperCol={{ span: 10 }}
              >
                <Select
                  allowClear
                  loading={embeddingProvidersLoading}
                  options={embeddingOptions}
                  optionFilterProp="label"
                />
              </Form.Item>
              : null
            }
            <Form.Item
              label="Graph Store"
              name="graphStoreProvider"
              wrapperCol={{ span: 10 }}
            >
              <Select
                allowClear
                disabled={!!vectorStoreProviderValue}
                loading={graphStoresLoading}
                options={graphStoreOptions}
                optionFilterProp="label"
              />
            </Form.Item>
          </>
          : null
        }
        {!isDataSource && ext === 'txt' ?
          <>
            {/* <Form.Item
              label="Text Property"
              name="textProperty"
              initialValue="text"
            >
              <Input />
            </Form.Item> */}
            <Form.Item
              label="Split by"
              name="splitter"
            >
              <Select allowClear
                options={splitterOptions}
                optionFilterProp="label"
              />
            </Form.Item>
            {splitterValue === 'delimiter' ?
              <Form.Item
                label="Character(s)"
                name="characters"
                initialValue="\n\n"
                wrapperCol={{ span: 5 }}
              >
                <Input />
              </Form.Item>
              : null
            }
            {splitterValue === 'chunker' ?
              <Form.Item
                label="Chunker"
                name="functionId"
              >
                <Select allowClear
                  loading={functionsLoading}
                  options={functionOptions}
                  optionFilterProp="label"
                />
              </Form.Item>
              : null
            }
            {splitterValue === 'token' ?
              <>
                <Form.Item
                  label="Chunk Size"
                  name="chunkSize"
                  initialValue="2048"
                  wrapperCol={{ span: 5 }}
                >
                  <Input type="number" />
                </Form.Item>
                <Form.Item
                  label="Chunk Overlap"
                  name="chunkOverlap"
                  initialValue="24"
                  wrapperCol={{ span: 5 }}
                >
                  <Input type="number" />
                </Form.Item>
              </>
              : null
            }
          </>
          : null
        }
        {indexValue === 'new' && (ext === 'csv' || type === 'crawler' || type === 'api') ?
          <>
            <Form.Item
              label="Title Field"
              name="titleField"
              wrapperCol={{ span: 5 }}
            >
              <Input />
            </Form.Item>
            <Form.Item
              label="Vector Field"
              name="vectorField"
              wrapperCol={{ span: 5 }}
            >
              <Input />
            </Form.Item>
          </>
          : null
        }
        {!isDataSource && ext === 'csv' ?
          <>
            <Form.Item
              label="Delimiter"
              name="delimiter"
              initialValue=","
              wrapperCol={{ span: 5 }}
            >
              <Input />
            </Form.Item>
            <Form.Item
              label="Quote Char"
              name="quoteChar"
              initialValue={'"'}
              wrapperCol={{ span: 5 }}
            >
              <Input />
            </Form.Item>
          </>
          : null
        }
        {graphStoreProviderValue ?
          <>
            <Form.Item
              label="Allowed Nodes"
              name="allowedNodes"
              wrapperCol={{ span: 10 }}
            >
              <TagsInput />
            </Form.Item>
            <Form.Item
              label="Allowed Rels"
              name="allowedRels"
              wrapperCol={{ span: 10 }}
            >
              <TagsInput />
            </Form.Item>
          </>
          : null
        }
      </Form>
    </Modal>
  )
}
