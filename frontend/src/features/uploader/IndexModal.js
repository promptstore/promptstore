import { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Divider, Form, Input, Modal, Select, Space } from 'antd';
import { PlusOutlined } from '@ant-design/icons';

import { engineOptions } from '../../options';
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
  width = 800,
}) {

  const [newIndex, setNewIndex] = useState('');

  const functions = useSelector(selectFunctions);
  const functionsLoaded = useSelector(selectFunctionsLoaded);
  const functionsLoading = useSelector(selectFunctionsLoading);
  const indexes = useSelector(selectIndexes);
  const indexesLoaded = useSelector(selectIndexesLoaded);
  const indexesLoading = useSelector(selectIndexesLoading);

  const functionOptions = useMemo(() => {
    return Object.values(functions)
      .filter((func) => func.tags?.includes(CHUNKER_TAG))
      .map((func) => ({
        label: func.name,
        value: func.id,
      }));
  }, [functions]);

  const indexOptions = useMemo(() => {
    return Object.values(indexes)
      .map((index) => ({
        label: index.name,
        value: index.id,
      }));
  }, [indexes]);

  const dispatch = useDispatch();

  const newIndexInputRef = useRef(null);

  const [form] = Form.useForm();
  const indexValue = Form.useWatch('indexId', form);
  const splitterValue = Form.useWatch('splitter', form);

  useEffect(() => {
    if (!indexesLoaded && open) {
      dispatch(getIndexesAsync());
    }
  }, [indexesLoaded, open]);

  useEffect(() => {
    if (!functionsLoaded && splitterValue === 'chunker') {
      dispatch(getFunctionsByTagAsync({ tag: CHUNKER_TAG }));
    }
  }, [functionsLoaded, splitterValue]);

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
    form.resetFields();
    onCancel();
  }

  const handleOk = async () => {
    const values = await form.validateFields();
    onSubmit({ ...values, newIndexName: newIndex });
  };

  const onNewIndexChange = (ev) => {
    setNewIndex(ev.target.value);
  };

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
          <Form.Item
            label="Engine"
            name="engine"
            rules={[
              {
                required: true,
                message: 'Please select the engine',
              },
            ]}
            wrapperCol={{ span: 10 }}
          >
            <Select options={engineOptions} />
          </Form.Item>
          : null
        }
        {!isDataSource && ext === 'txt' ?
          <>
            <Form.Item
              label="Text Property"
              name="textProperty"
              initialValue="text"
            >
              <Input />
            </Form.Item>
            <Form.Item
              label="Split by"
              name="splitter"
            >
              <Select allowClear
                options={splitterOptions}
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
                />
              </Form.Item>

              : null
            }
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
      </Form>
    </Modal>
  )
}
