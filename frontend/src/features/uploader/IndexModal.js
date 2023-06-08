import { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Form, Input, Modal, Select } from 'antd';

import {
  getFunctionsByTagAsync,
  selectFunctions,
  selectLoading as selectFunctionsLoading,
} from '../functions/functionsSlice';
import {
  getIndexesAsync,
  selectIndexes,
  selectLoading as selectIndexesLoading,
} from '../indexes/indexesSlice';

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

  // console.log('ext:', ext);

  const functions = useSelector(selectFunctions);
  const functionsLoading = useSelector(selectFunctionsLoading);
  const indexes = useSelector(selectIndexes);
  const indexesLoading = useSelector(selectIndexesLoading);

  const functionOptions = useMemo(() => Object.values(functions).map((func) => ({
    label: func.name,
    value: func.id,
  })), [functions]);

  const indexOptions = useMemo(() => Object.values(indexes).map((index) => ({
    label: index.name,
    value: index.id,
  })), [indexes]);

  const dispatch = useDispatch();

  const [form] = Form.useForm();
  const splitterValue = Form.useWatch('splitter', form);

  useEffect(() => {
    dispatch(getIndexesAsync());
    dispatch(getFunctionsByTagAsync({ tag: 'chunker' }));
  }, []);

  const handleOk = async () => {
    const values = await form.validateFields();
    onSubmit(values);
  };

  return (
    <Modal
      onCancel={onCancel}
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
        >
          <Select allowClear
            loading={indexesLoading}
            options={indexOptions}
          />
        </Form.Item>
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
