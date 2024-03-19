import { memo, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Handle, Position, useReactFlow, useStoreApi } from 'reactflow';
import { Form, Input, Modal } from 'antd';
import { SettingOutlined } from '@ant-design/icons';

import {
  getVectorStoresAsync,
  selectVectorStores,
  selectLoaded as selectVectorStoresLoaded,
} from '../uploader/vectorStoresSlice';

const { TextArea } = Input;

const layout = {
  labelCol: { span: 24 },
  wrapperCol: { span: 24 },
};

export default memo(({ id, data, isConnectable }) => {

  const [modalOpen, setModalOpen] = useState(false);

  const stores = useSelector(selectVectorStores);
  const storesLoaded = useSelector(selectVectorStoresLoaded);

  const [form] = Form.useForm();

  const vectorStoreOptions = useMemo(() => {
    if (stores) {
      const options = Object.values(stores).map((s) => ({
        label: s.name,
        value: s.key,
      }));
      options.sort((a, b) => a.label < b.label ? -1 : 1);
      options.unshift({ label: 'Select', value: -1 });
      return options;
    }
  }, [stores]);

  const { setNodes } = useReactFlow();
  const store = useStoreApi();

  const dispatch = useDispatch();

  useEffect(() => {
    if (!storesLoaded) {
      dispatch(getVectorStoresAsync());
    }
  }, [storesLoaded]);

  const onChange = (evt) => {
    const { nodeInternals } = store.getState();
    setNodes(
      Array.from(nodeInternals.values()).map((node) => {
        if (node.id === id) {
          const vectorStoreProvider = evt.target.value;
          node.data = {
            ...node.data,
            vectorStoreProvider,
          };
        }
        return node;
      })
    );
  };

  const onCancel = () => {
    setModalOpen(false);
  };

  const onOk = async () => {
    const values = await form.validateFields();
    console.log('values:', values);
    const { nodeInternals } = store.getState();
    setNodes(
      Array.from(nodeInternals.values()).map((node) => {
        if (node.id === id) {
          node.data = {
            ...node.data,
            ...values,
          };
        }
        return node;
      })
    );
    setModalOpen(false);
  };

  return (
    <>
      <Modal
        onCancel={onCancel}
        onOk={onOk}
        open={modalOpen}
        title="Settings"
      >
        <Form
          {...layout}
          form={form}
          initialValues={data}
        >
          <Form.Item
            label="Name"
            name="newIndexName"
            rules={[
              {
                required: true,
                message: 'Please enter a name',
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
        </Form>
      </Modal>
      <div className="custom-node__header" style={{ display: 'flex' }}>
        <div>{data?.vectorStoreProvider === 'elasticsearch' ? 'Search Index' : 'Vector Store'}</div>
        <div style={{ flex: 1 }} />
        <SettingOutlined
          style={{ cursor: 'pointer' }}
          onClick={() => setModalOpen(true)}
        />
      </div>
      <div className="custom-node__body">
        <Select
          isConnectable={isConnectable}
          nodeId={id}
          onChange={onChange}
          options={vectorStoreOptions}
          value={data.vectorStoreProvider}
        />
      </div>
    </>
  );
});

function Select({ isConnectable, onChange, options, value }) {
  return (
    <div className="custom-node__select">
      <select className="nodrag" onChange={onChange} value={value}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Handle type="target" position={Position.Left} isConnectable={isConnectable} />
      <Handle type="source" position={Position.Right} id="a" isConnectable={isConnectable} />
    </div>
  );
}
