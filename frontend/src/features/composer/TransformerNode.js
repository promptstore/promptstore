import { memo, useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Handle, Position, useReactFlow, useStoreApi } from 'reactflow';
import { Form, Input, Modal } from 'antd';
import { SettingOutlined } from '@ant-design/icons';

import WorkspaceContext from '../../contexts/WorkspaceContext';
import {
  getFunctionsAsync,
  selectFunctions,
  selectLoaded as selectFunctionsLoaded,
} from '../functions/functionsSlice';

const layout = {
  labelCol: { span: 24 },
  wrapperCol: { span: 24 },
};

export default memo(({ id, data, isConnectable }) => {

  const [modalOpen, setModalOpen] = useState(false);

  const functions = useSelector(selectFunctions);
  const functionsLoaded = useSelector(selectFunctionsLoaded);

  const functionOptions = useMemo(() => {
    if (functions) {
      const options = Object.values(functions).map((t) => ({
        label: t.name,
        value: t.id,
      }));
      options.sort((a, b) => a.label < b.label ? -1 : 1);
      options.unshift({ label: 'Select', value: -1 });
      return options;
    }
  }, [functions]);

  const { setNodes } = useReactFlow();
  const store = useStoreApi();

  const { selectedWorkspace } = useContext(WorkspaceContext);
  const dispatch = useDispatch();
  const [form] = Form.useForm();

  useEffect(() => {
    if (selectedWorkspace && !functionsLoaded) {
      const workspaceId = selectedWorkspace.id;
      dispatch(getFunctionsAsync({ workspaceId }));
    }
  }, [selectedWorkspace, functionsLoaded]);

  const onChange = (evt) => {
    const { nodeInternals } = store.getState();
    setNodes(
      Array.from(nodeInternals.values()).map((node) => {
        if (node.id === id) {
          const functionId = evt.target.value;
          node.data = {
            ...node.data,
            functionId,
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
            label="Content Path"
            name="contentPath"
          >
            <Input />
          </Form.Item>
        </Form>
      </Modal>
      <div className="custom-node__header" style={{ display: 'flex' }}>
        <div>Transformation</div>
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
          options={functionOptions}
          value={data.functionId}
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
